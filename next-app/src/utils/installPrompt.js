/** sessionStorage flag: show install popup after a successful login */
export const INSTALL_PROMPT_LOGIN_FLAG = 'monteeq_show_install_after_login';

export const INSTALL_PROMPT_EVENT = 'monteeq:request-install-prompt';

/** Call after password / Google / 2FA login succeeds. */
export function requestInstallPromptAfterLogin() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(INSTALL_PROMPT_LOGIN_FLAG, '1');
    window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
  } catch {
    /* ignore */
  }
}

export function hasPendingInstallPromptAfterLogin() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(INSTALL_PROMPT_LOGIN_FLAG) === '1';
  } catch {
    return false;
  }
}

export function clearPendingInstallPromptAfterLogin() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(INSTALL_PROMPT_LOGIN_FLAG);
  } catch {
    /* ignore */
  }
}
