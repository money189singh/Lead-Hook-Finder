import net from 'net';
import { SmtpProbeResult } from './types';

export class SmtpProber {
  private static readonly DEFAULT_TIMEOUT_MS = 5000;
  private static smtpAvailableInEnv: boolean | null = null;

  /**
   * Quick probe to test if outbound port 25 is permitted in the deployment environment.
   */
  public static async testEnvironmentSmtpCapability(): Promise<boolean> {
    if (this.smtpAvailableInEnv !== null) {
      return this.smtpAvailableInEnv;
    }

    try {
      // Test connect to a known reliable public MX (e.g., aspmx.l.google.com) on port 25 with 3s timeout
      const socket = new net.Socket();
      const testPromise = new Promise<boolean>((resolve) => {
        socket.setTimeout(3000);
        socket.connect(25, 'aspmx.l.google.com', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });

      this.smtpAvailableInEnv = await testPromise;
    } catch {
      this.smtpAvailableInEnv = false;
    }

    return this.smtpAvailableInEnv;
  }

  /**
   * Safely probe an email's mail server via SMTP.
   * NEVER marks an email invalid merely because SMTP is blocked, rate-limited, or disabled.
   */
  public static async probe(
    email: string,
    mxHost: string,
    timeoutMs: number = this.DEFAULT_TIMEOUT_MS
  ): Promise<SmtpProbeResult> {
    const startTime = Date.now();

    if (!mxHost) {
      return {
        smtpStatus: 'unavailable',
        error: 'No mail exchange host available for SMTP probing',
        latencyMs: 0,
      };
    }

    return new Promise<SmtpProbeResult>((resolve) => {
      let resolved = false;
      const socket = new net.Socket();
      let step: 'INIT' | 'HELO' | 'MAIL_FROM' | 'RCPT_TO' | 'QUIT' = 'INIT';
      let banner = '';
      let lastCode = 0;
      let lastResponse = '';

      const cleanupAndResolve = (result: SmtpProbeResult) => {
        if (resolved) return;
        resolved = true;
        try {
          if (!socket.destroyed) {
            socket.write('QUIT\r\n');
            socket.destroy();
          }
        } catch {}
        resolve({
          ...result,
          latencyMs: Date.now() - startTime,
        });
      };

      socket.setTimeout(timeoutMs);

      socket.connect(25, mxHost, () => {
        // Connected, waiting for initial 220 banner
      });

      socket.on('data', (data) => {
        const text = data.toString('utf8');
        const lines = text.split('\r\n').filter(Boolean);
        const lastLine = lines[lines.length - 1] || text;
        const code = parseInt(lastLine.substring(0, 3), 10);
        lastCode = code;
        lastResponse = lastLine;

        if (step === 'INIT') {
          banner = lastLine;
          if (code === 220) {
            step = 'HELO';
            socket.write('EHLO leadhook.local\r\n');
          } else {
            cleanupAndResolve({
              smtpStatus: 'unavailable',
              code,
              banner,
              response: lastResponse,
              error: `Mail server returned non-220 banner: ${code}`,
            });
          }
        } else if (step === 'HELO') {
          if (code === 250) {
            step = 'MAIL_FROM';
            socket.write('MAIL FROM:<verify@leadhook.local>\r\n');
          } else if (code === 500 || code === 502) {
            // Fallback to standard HELO
            socket.write('HELO leadhook.local\r\n');
          } else {
            cleanupAndResolve({
              smtpStatus: 'blocked',
              code,
              banner,
              response: lastResponse,
              error: `EHLO rejected by server: ${code}`,
            });
          }
        } else if (step === 'MAIL_FROM') {
          if (code === 250) {
            step = 'RCPT_TO';
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            cleanupAndResolve({
              smtpStatus: 'blocked',
              code,
              banner,
              response: lastResponse,
              error: `MAIL FROM rejected: ${code}`,
            });
          }
        } else if (step === 'RCPT_TO') {
          if (code === 250 || code === 251) {
            cleanupAndResolve({
              smtpStatus: 'accepted',
              code,
              banner,
              response: lastResponse,
            });
          } else if (code >= 550 && code <= 559) {
            cleanupAndResolve({
              smtpStatus: 'rejected',
              code,
              banner,
              response: lastResponse,
              error: `Mailbox rejected: ${lastResponse}`,
            });
          } else if (code >= 400 && code < 500) {
            cleanupAndResolve({
              smtpStatus: 'blocked',
              code,
              banner,
              response: lastResponse,
              error: `Temporary server deferral / greylisting: ${lastResponse}`,
            });
          } else {
            cleanupAndResolve({
              smtpStatus: 'unavailable',
              code,
              banner,
              response: lastResponse,
              error: `Inconclusive RCPT TO response: ${code}`,
            });
          }
        }
      });

      socket.on('error', (err: any) => {
        // Typical Cloud Run / Preview Port 25 block errors: ECONNREFUSED, ETIMEDOUT, ENETUNREACH
        const isBlocked =
          err.code === 'ECONNREFUSED' ||
          err.code === 'ENETUNREACH' ||
          err.code === 'EHOSTUNREACH' ||
          err.code === 'EACCES';

        cleanupAndResolve({
          smtpStatus: isBlocked ? 'blocked' : 'unavailable',
          error: isBlocked
            ? `Outbound SMTP port 25 connection blocked/refused by network or mail server (${err.code})`
            : `SMTP socket error: ${err.message}`,
        });
      });

      socket.on('timeout', () => {
        cleanupAndResolve({
          smtpStatus: 'timeout',
          error: `SMTP connection to ${mxHost}:25 timed out after ${timeoutMs}ms`,
        });
      });
    });
  }
}
