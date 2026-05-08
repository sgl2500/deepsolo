// ============================================================
// AuthOverlay.ts — 登录/注册入口
// ============================================================

import type { AuthStore } from '../core/AuthStore';
import { ENABLE_DEMO_AUTH } from '../config';

type AuthMode = 'login' | 'register';

export class AuthOverlay {
  private root: HTMLElement;
  private mode: AuthMode = 'login';
  private form!: HTMLFormElement;
  private titleEl!: HTMLElement;
  private subtitleEl!: HTMLElement;
  private submitBtn!: HTMLButtonElement;
  private switchBtn!: HTMLButtonElement;
  private messageEl!: HTMLElement;
  private usernameInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;

  constructor(
    private container: HTMLElement,
    private authStore: AuthStore,
    private onAuthenticated: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'auth-screen';
    this.render();
    this.container.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-mark">深</div>
          <div>
            <div class="auth-kicker">DEEPSOLO STRATEGY WORLD</div>
            <h1></h1>
            <p></p>
          </div>
        </div>
        <form class="auth-form">
          <label>
            <span>用户名</span>
            <input name="username" autocomplete="username" placeholder="sgl2500" />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autocomplete="current-password" placeholder="123" />
          </label>
          <button class="auth-submit" type="submit"></button>
          <div class="auth-message" aria-live="polite"></div>
        </form>
        <div class="auth-foot">
          <span></span>
          <button type="button" class="auth-switch"></button>
        </div>
      </div>
    `;

    this.titleEl = this.root.querySelector('.auth-brand h1')!;
    this.subtitleEl = this.root.querySelector('.auth-brand p')!;
    this.form = this.root.querySelector('.auth-form')!;
    this.submitBtn = this.root.querySelector('.auth-submit')!;
    this.switchBtn = this.root.querySelector('.auth-switch')!;
    this.messageEl = this.root.querySelector('.auth-message')!;
    this.usernameInput = this.root.querySelector<HTMLInputElement>('input[name="username"]')!;
    this.passwordInput = this.root.querySelector<HTMLInputElement>('input[name="password"]')!;
    this.usernameInput.placeholder = ENABLE_DEMO_AUTH ? 'sgl2500' : '请输入用户名';
    this.passwordInput.placeholder = ENABLE_DEMO_AUTH ? '123' : '请输入密码';

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.switchBtn.addEventListener('click', () => {
      this.mode = this.mode === 'login' ? 'register' : 'login';
      this.messageEl.textContent = '';
      this.updateMode();
    });

    if (ENABLE_DEMO_AUTH) {
      this.usernameInput.value = 'sgl2500';
      this.passwordInput.value = '123';
    }
    this.updateMode();
    this.usernameInput.focus();
  }

  private updateMode(): void {
    const isLogin = this.mode === 'login';
    this.titleEl.textContent = isLogin ? '登入江湖' : '注册新角色';
    this.subtitleEl.textContent = isLogin
      ? ENABLE_DEMO_AUTH
        ? '用账号进入你的策略武侠世界，默认账号已初始化。'
        : '用账号进入你的策略武侠世界，新玩家请先注册。'
      : '创建一个本地账号，随后进入同一个策略世界。';
    this.submitBtn.textContent = isLogin ? '登入' : '注册并登入';
    this.root.querySelector('.auth-foot span')!.textContent = isLogin ? '还没有账号？' : '已经有账号？';
    this.switchBtn.textContent = isLogin ? '注册' : '返回登入';
    this.passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  }

  private submit(): void {
    const username = this.usernameInput.value;
    const password = this.passwordInput.value;
    const result = this.mode === 'login'
      ? this.authStore.login(username, password)
      : this.authStore.register(username, password);

    if (!result.ok) {
      this.messageEl.textContent = result.message;
      this.messageEl.className = 'auth-message auth-message-error';
      return;
    }

    this.messageEl.textContent = `欢迎，${result.user.username}`;
    this.messageEl.className = 'auth-message auth-message-ok';
    this.destroy();
    this.onAuthenticated();
  }
}
