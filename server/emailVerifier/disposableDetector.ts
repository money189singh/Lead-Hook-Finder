import { DisposableAndRoleResult } from './types';
import { KNOWN_DISPOSABLE_DOMAINS, ROLE_BASED_LOCAL_PARTS } from './disposableDataset';

export class DisposableAndRoleDetector {
  /**
   * Check if a domain is disposable and if the local-part is a role-based mailbox.
   */
  public static check(localPart: string, domain: string): DisposableAndRoleResult {
    const cleanDomain = domain.toLowerCase().trim();
    const cleanLocal = localPart.toLowerCase().trim();

    // Check exact domain and subdomains (e.g. sub.mailinator.com)
    let isDisposable = KNOWN_DISPOSABLE_DOMAINS.has(cleanDomain);
    if (!isDisposable) {
      const parts = cleanDomain.split('.');
      for (let i = 1; i < parts.length - 1; i++) {
        const sub = parts.slice(i).join('.');
        if (KNOWN_DISPOSABLE_DOMAINS.has(sub)) {
          isDisposable = true;
          break;
        }
      }
    }

    // Role-based local part check
    // Remove tags like sales+123 -> sales
    const baseLocal = cleanLocal.split('+')[0];
    const roleDept = ROLE_BASED_LOCAL_PARTS[baseLocal] || undefined;
    const isRoleAccount = Boolean(roleDept);

    return {
      isDisposable,
      disposableStatus: isDisposable ? 'disposable' : 'clean',
      isRoleAccount,
      roleDepartment: roleDept,
    };
  }
}
