import fs from 'fs';
import path from 'path';
import { QueueMetrics } from '../../src/types';

export type TaskPriority = 'high' | 'normal' | 'low';

export interface QueueTask<T = any, R = any> {
  id: string;
  data: T;
  priority: TaskPriority;
  domainKey: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  maxRetries: number;
  execute: (data: T) => Promise<R>;
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
}

export interface TaskQueueOptions {
  concurrency: number; // e.g., 3 - 20
  domainDelayMs: number; // minimum polite delay between crawls to the same domain
  stateFilePath?: string;
}

export class TaskQueue {
  private concurrency: number;
  private domainDelayMs: number;
  private queue: QueueTask[] = [];
  private activeTasks: Map<string, QueueTask> = new Map();
  private lastDomainAccess: Map<string, number> = new Map();
  private isPaused: boolean = false;
  private isDrained: boolean = false;
  private isStopped: boolean = false;
  private completedCount: number = 0;
  private failedCount: number = 0;
  private crawlDurations: number[] = [];
  private completedTimestamps: number[] = [];
  private stateFilePath: string;

  constructor(options: Partial<TaskQueueOptions> = {}) {
    this.concurrency = Math.max(1, options.concurrency || 3);
    this.domainDelayMs = options.domainDelayMs ?? 800;
    this.stateFilePath =
      options.stateFilePath || path.join(process.cwd(), 'data', 'queue_state.json');
  }

  public setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, Math.min(concurrency, 25));
    this.pump();
  }

  public setDomainDelay(delayMs: number): void {
    this.domainDelayMs = Math.max(0, delayMs);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.pump();
  }

  public stop(): void {
    this.isStopped = true;
    this.queue = [];
    this.activeTasks.clear();
  }

  public clear(): void {
    this.queue = [];
    this.activeTasks.clear();
    this.completedCount = 0;
    this.failedCount = 0;
    this.crawlDurations = [];
    this.completedTimestamps = [];
  }

  public enqueue<T, R>(task: {
    id: string;
    data: T;
    domainKey: string;
    priority?: TaskPriority;
    maxRetries?: number;
    execute: (data: T) => Promise<R>;
    onSuccess?: (result: R) => void;
    onError?: (error: Error) => void;
  }): void {
    const fullTask: QueueTask<T, R> = {
      id: task.id,
      data: task.data,
      domainKey: task.domainKey,
      priority: task.priority || 'normal',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: task.maxRetries ?? 1,
      execute: task.execute,
      onSuccess: task.onSuccess,
      onError: task.onError,
    };

    if (fullTask.priority === 'high') {
      // Put behind other high priority tasks
      const firstNonHigh = this.queue.findIndex((t) => t.priority !== 'high');
      if (firstNonHigh === -1) {
        this.queue.push(fullTask);
      } else {
        this.queue.splice(firstNonHigh, 0, fullTask);
      }
    } else if (fullTask.priority === 'low') {
      this.queue.push(fullTask);
    } else {
      // Normal priority: place before low priority tasks
      const firstLow = this.queue.findIndex((t) => t.priority === 'low');
      if (firstLow === -1) {
        this.queue.push(fullTask);
      } else {
        this.queue.splice(firstLow, 0, fullTask);
      }
    }

    this.pump();
  }

  public getMetrics(): QueueMetrics {
    const now = Date.now();
    // Prune timestamps older than 60s for rolling throughput
    this.completedTimestamps = this.completedTimestamps.filter((t) => now - t <= 60000);
    const throughputPerMinute = this.completedTimestamps.length;

    // Moving average of last 20 crawl durations
    const avgDomainCrawlMs =
      this.crawlDurations.length > 0
        ? Math.round(this.crawlDurations.reduce((a, b) => a + b, 0) / this.crawlDurations.length)
        : 2500;

    const remainingTasks = this.queue.length;
    let estimatedTimeRemainingSec = 0;
    if (throughputPerMinute > 0) {
      estimatedTimeRemainingSec = Math.round((remainingTasks / throughputPerMinute) * 60);
    } else if (this.concurrency > 0) {
      estimatedTimeRemainingSec = Math.round(((remainingTasks * avgDomainCrawlMs) / this.concurrency) / 1000);
    }

    return {
      pendingTasks: this.queue.length,
      activeWorkers: this.activeTasks.size,
      completedTasks: this.completedCount,
      failedTasks: this.failedCount,
      throughputPerMinute,
      avgDomainCrawlMs,
      estimatedTimeRemainingSec,
    };
  }

  public isBusy(): boolean {
    return this.activeTasks.size > 0 || this.queue.length > 0;
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getActiveCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Internal scheduler loop (the pump)
   */
  private pump(): void {
    if (this.isPaused || this.isStopped) return;

    while (this.activeTasks.size < this.concurrency && this.queue.length > 0) {
      const now = Date.now();

      // Find first task whose domain isn't in cooldown
      let candidateIndex = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const task = this.queue[i];
        const lastAccess = this.lastDomainAccess.get(task.domainKey) || 0;
        if (now - lastAccess >= this.domainDelayMs) {
          candidateIndex = i;
          break;
        }
      }

      // If no task is ready immediately due to domain rate-limiting, schedule a wake-up
      if (candidateIndex === -1) {
        let minWait = this.domainDelayMs;
        for (const task of this.queue) {
          const last = this.lastDomainAccess.get(task.domainKey) || 0;
          const wait = this.domainDelayMs - (now - last);
          if (wait > 0 && wait < minWait) {
            minWait = wait;
          }
        }
        setTimeout(() => this.pump(), Math.max(100, minWait));
        return;
      }

      const [task] = this.queue.splice(candidateIndex, 1);
      this.activeTasks.set(task.id, task);
      this.lastDomainAccess.set(task.domainKey, now);

      task.startedAt = Date.now();
      this.runTask(task);
    }

    // Save snapshot occasionally
    if (this.queue.length % 10 === 0) {
      this.saveStateSnapshot();
    }
  }

  private async runTask(task: QueueTask): Promise<void> {
    try {
      const result = await task.execute(task.data);
      const duration = Date.now() - (task.startedAt || Date.now());

      this.completedCount++;
      this.completedTimestamps.push(Date.now());
      this.crawlDurations.push(duration);
      if (this.crawlDurations.length > 30) {
        this.crawlDurations.shift();
      }

      task.completedAt = Date.now();
      if (task.onSuccess) {
        try {
          task.onSuccess(result);
        } catch (e) {
          console.error('Error in task onSuccess handler:', e);
        }
      }
    } catch (err: any) {
      if (task.retries < task.maxRetries && !this.isStopped) {
        task.retries++;
        this.queue.unshift(task); // Retry with priority
      } else {
        this.failedCount++;
        if (task.onError) {
          try {
            task.onError(err);
          } catch (e) {
            console.error('Error in task onError handler:', e);
          }
        }
      }
    } finally {
      this.activeTasks.delete(task.id);
      this.pump();
    }
  }

  private saveStateSnapshot(): void {
    try {
      const data = {
        metrics: this.getMetrics(),
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // ignore snapshot save error
    }
  }
}
