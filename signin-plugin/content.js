console.log('iKunCode签到助手内容脚本已加载');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'performSignIn') {
    performSignIn();
  } else if (message.action === 'performLogin') {
    performLogin(message.credentials);
  }
});

async function performLogin(credentials) {
  console.log('开始执行自动登录');

  try {
    await waitForPageLoad();

    if (isUserLoggedIn()) {
      sendLoginResult(true, '用户已登录');
      return;
    }

    const loginForm = findLoginForm();
    if (!loginForm) {
      sendLoginResult(false, '未找到登录表单');
      return;
    }

    const usernameField = findUsernameField(loginForm);
    const passwordField = findPasswordField(loginForm);
    const loginButton = findLoginButton(loginForm);

    if (!usernameField || !passwordField || !loginButton) {
      sendLoginResult(false, '未找到登录字段或按钮');
      return;
    }

    usernameField.value = credentials.username;
    usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    usernameField.dispatchEvent(new Event('change', { bubbles: true }));

    passwordField.value = credentials.password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 500));

    loginButton.click();
    console.log('已点击登录按钮');

    await waitForLoginResult();

  } catch (error) {
    console.error('登录过程出错:', error);
    sendLoginResult(false, '登录过程出错: ' + error.message);
  }
}

function findLoginForm() {
  const selectors = [
    'form[class*="login"]',
    'form[id*="login"]',
    'form[class*="signin"]',
    'form[id*="signin"]',
    'form[action*="login"]',
    'form[action*="signin"]',
    '.login-form',
    '.signin-form',
    '#loginForm',
    '#signinForm'
  ];

  for (const selector of selectors) {
    const form = document.querySelector(selector);
    if (form) return form;
  }

  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const usernameField = form.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
    const passwordField = form.querySelector('input[type="password"]');
    if (usernameField && passwordField) {
      return form;
    }
  }

  return null;
}

function findUsernameField(form) {
  const selectors = [
    'input[name*="username"]',
    'input[name*="user"]',
    'input[name*="email"]',
    'input[name*="login"]',
    'input[id*="username"]',
    'input[id*="user"]',
    'input[id*="email"]',
    'input[id*="login"]',
    'input[type="email"]',
    'input[type="text"]'
  ];

  for (const selector of selectors) {
    const field = form.querySelector(selector);
    if (field) return field;
  }

  return null;
}

function findPasswordField(form) {
  return form.querySelector('input[type="password"]');
}

function findLoginButton(form) {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[class*="login"]',
    'button[id*="login"]',
    'button[class*="signin"]',
    'button[id*="signin"]',
    '.login-btn',
    '.signin-btn'
  ];

  for (const selector of selectors) {
    const button = form.querySelector(selector);
    if (button) return button;
  }

  const buttons = form.querySelectorAll('button, input[type="button"]');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('登录') || text.includes('login') || text.includes('登陆')) {
      return button;
    }
  }

  return null;
}

async function waitForLoginResult() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 15;

    const checkResult = () => {
      attempts++;

      if (isUserLoggedIn()) {
        sendLoginResult(true, '登录成功');
        resolve();
        return;
      }

      const errorIndicators = [
        '用户名或密码错误',
        '登录失败',
        'incorrect.*password',
        'invalid.*credentials',
        'login.*failed',
        'error'
      ];

      const pageText = document.body.textContent.toLowerCase();

      for (const indicator of errorIndicators) {
        if (new RegExp(indicator, 'i').test(pageText)) {
          sendLoginResult(false, '登录失败：用户名或密码错误');
          resolve();
          return;
        }
      }

      if (attempts < maxAttempts) {
        setTimeout(checkResult, 1000);
      } else {
        sendLoginResult(false, '登录结果未知，请手动检查');
        resolve();
      }
    };

    setTimeout(checkResult, 2000);
  });
}

function sendLoginResult(success, message) {
  console.log(`登录结果: ${success ? '成功' : '失败'} - ${message}`);

  chrome.runtime.sendMessage({
    action: 'loginResult',
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  });
}

async function performSignIn() {
  console.log('开始执行签到操作');

  try {
    await waitForPageLoad();

    if (!isUserLoggedIn()) {
      sendSignInResult(false, '用户未登录，请先登录网站');
      return;
    }

    const signInButton = findSignInButton();

    if (!signInButton) {
      sendSignInResult(false, '未找到签到按钮');
      return;
    }

    if (isAlreadySignedIn()) {
      sendSignInResult(true, '今日已签到');
      return;
    }

    signInButton.click();
    console.log('已点击签到按钮');

    await waitForSignInResult();

  } catch (error) {
    console.error('签到过程出错:', error);
    sendSignInResult(false, '签到过程出错: ' + error.message);
  }
}

function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

function isUserLoggedIn() {
  const loginIndicators = [
    'a[href*="logout"]',
    '.user-info',
    '.user-avatar',
    '[class*="user"]',
    '[id*="user"]'
  ];

  for (const selector of loginIndicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  const loginButtons = document.querySelectorAll('a, button');
  for (const button of loginButtons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('登录') || text.includes('login')) {
      return false;
    }
  }

  return document.querySelector('input[type="password"]') === null;
}

function findSignInButton() {
  const selectors = [
    'button[class*="sign"]',
    'a[class*="sign"]',
    'button[id*="sign"]',
    'a[id*="sign"]',
    '.sign-in-btn',
    '.signin-btn',
    '#signIn',
    '#sign_in'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  const buttons = document.querySelectorAll('button, a, .btn');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('签到') || text.includes('sign')) {
      return button;
    }
  }

  return null;
}

function isAlreadySignedIn() {
  const indicators = [
    '.signed-in',
    '.already-signed',
    '.sign-success'
  ];

  for (const selector of indicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }

  const textElements = document.querySelectorAll('*');
  for (const element of textElements) {
    const text = element.textContent;
    if (text.includes('已签到') || text.includes('今日已签到')) {
      return true;
    }
  }

  return false;
}

async function waitForSignInResult() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 10;

    const checkResult = () => {
      attempts++;

      const successIndicators = [
        '签到成功',
        '打卡成功',
        'sign.*success',
        '积分.*\\+',
        '奖励'
      ];

      const failureIndicators = [
        '签到失败',
        '已签到',
        '今日已签到',
        'already.*signed',
        'sign.*failed'
      ];

      const pageText = document.body.textContent;

      for (const indicator of successIndicators) {
        if (new RegExp(indicator, 'i').test(pageText)) {
          sendSignInResult(true, '签到成功');
          resolve();
          return;
        }
      }

      for (const indicator of failureIndicators) {
        if (new RegExp(indicator, 'i').test(pageText)) {
          sendSignInResult(true, '今日已签到');
          resolve();
          return;
        }
      }

      if (attempts < maxAttempts) {
        setTimeout(checkResult, 1000);
      } else {
        sendSignInResult(false, '签到结果未知，请手动检查');
        resolve();
      }
    };

    setTimeout(checkResult, 1000);
  });
}

function sendSignInResult(success, message) {
  console.log(`签到结果: ${success ? '成功' : '失败'} - ${message}`);

  chrome.runtime.sendMessage({
    action: 'signInResult',
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  });
}