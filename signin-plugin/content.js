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
  console.log('当前页面URL:', window.location.href);

  try {
    await waitForPageLoad();

    // 检查是否在个人设置页面
    if (window.location.href.includes('/app/me')) {
      console.log('✅ 已在个人设置页面，直接执行签到');
      await performSignInOnMePage();
      return;
    }

    // 如果不在个人设置页面，需要导航
    if (!isUserLoggedIn()) {
      sendSignInResult(false, '用户未登录，请先登录网站');
      return;
    }

    // 尝试导航到个人设置页面
    console.log('🔄 尝试导航到个人设置页面...');
    await navigateToMePage();

  } catch (error) {
    console.error('签到过程出错:', error);
    sendSignInResult(false, '签到过程出错: ' + error.message);
  }
}

async function performSignInOnMePage() {
  console.log('🎯 在个人设置页面执行签到');

  // 等待页面完全加载
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 检查是否已经签到
  if (isAlreadySignedIn()) {
    sendSignInResult(true, '今日已签到');
    return;
  }

  // 查找签到按钮
  const signInButton = findSignInButton();

  if (!signInButton) {
    // 如果没找到按钮，可能页面还在加载，再等待一下
    console.log('⏳ 未找到签到按钮，等待页面加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const signInButtonRetry = findSignInButton();
    if (!signInButtonRetry) {
      sendSignInResult(false, '在个人设置页面未找到签到按钮');
      return;
    }

    signInButtonRetry.click();
    console.log('已点击签到按钮 (重试)');
  } else {
    signInButton.click();
    console.log('已点击签到按钮');
  }

  await waitForSignInResult();
}

async function navigateToMePage() {
  // 查找控制台按钮
  const consoleButton = findConsoleButton();
  if (consoleButton) {
    console.log('🎯 找到控制台按钮，点击');
    consoleButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 查找个人设置按钮
    const meButton = findMeButton();
    if (meButton) {
      console.log('🎯 找到个人设置按钮，点击');
      meButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 现在应该在个人设置页面了
      await performSignInOnMePage();
      return;
    }
  }

  // 如果找不到按钮，直接通过URL导航
  console.log('🔄 通过URL直接导航到个人设置页面');
  window.location.href = 'https://hk.ikuncode.cc/app/me';
}

function findConsoleButton() {
  const selectors = [
    'a[href*="app"]',
    'button[class*="console"]',
    'a[class*="console"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  const buttons = document.querySelectorAll('a, button');
  for (const button of buttons) {
    const text = button.textContent.trim();
    if (text.includes('控制台') || text.includes('dashboard') || text.includes('app')) {
      return button;
    }
  }

  return null;
}

function findMeButton() {
  const selectors = [
    'a[href*="/me"]',
    'a[href*="profile"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  const buttons = document.querySelectorAll('a, button');
  for (const button of buttons) {
    const text = button.textContent.trim();
    if (text.includes('个人设置') || text.includes('profile') || text.includes('me') || text.includes('我的')) {
      return button;
    }
  }

  return null;
}

function waitForPageLoad() {
  return new Promise((resolve) => {
    console.log('⏳ 等待页面加载完成...');
    console.log('当前加载状态:', document.readyState);

    if (document.readyState === 'complete') {
      console.log('✅ 页面已加载完成');
      // 额外等待一段时间，确保SPA完全渲染
      setTimeout(() => {
        console.log('✅ 额外等待完成，开始执行操作');
        resolve();
      }, 2000);
    } else {
      window.addEventListener('load', () => {
        console.log('✅ 页面加载事件触发');
        // 额外等待一段时间，确保SPA完全渲染
        setTimeout(() => {
          console.log('✅ 额外等待完成，开始执行操作');
          resolve();
        }, 2000);
      });
    }
  });
}

function isUserLoggedIn() {
  console.log('🔐 检查用户登录状态...');

  const loginIndicators = [
    'a[href*="logout"]',
    '.user-info',
    '.user-avatar',
    '[class*="user"]',
    '[id*="user"]',
    // 添加更多登录指示器
    '.profile',
    '.avatar',
    '[class*="profile"]',
    '[class*="avatar"]',
    'button[class*="logout"]',
    'a[class*="logout"]'
  ];

  console.log('🎯 检查登录指示器...');
  for (const selector of loginIndicators) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`✅ 找到登录指示器 (${selector}):`, element);
      console.log('元素文本:', element.textContent);
      return true;
    }
  }

  // 检查登录按钮
  console.log('🔍 检查是否存在登录按钮...');
  const loginButtons = document.querySelectorAll('a, button');
  for (const button of loginButtons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('登录') || text.includes('login')) {
      console.log('❌ 找到登录按钮，用户未登录:', button);
      return false;
    }
  }

  // 检查密码输入框
  const passwordField = document.querySelector('input[type="password"]');
  if (passwordField) {
    console.log('❌ 找到密码输入框，用户未登录');
    return false;
  }

  // 打印页面所有链接和按钮用于调试
  console.log('📋 页面中所有链接和按钮:');
  const allClickable = document.querySelectorAll('a, button');
  allClickable.forEach((element, index) => {
    console.log(`元素${index + 1}:`, {
      text: element.textContent.trim(),
      href: element.href || '',
      class: element.className,
      id: element.id,
      tag: element.tagName
    });
  });

  console.log('✅ 未找到明确的登录/注销指示器，假设已登录');
  return true;
}

function findSignInButton() {
  console.log('🔍 开始查找签到按钮...');

  // 打印页面基本信息
  console.log('页面URL:', window.location.href);
  console.log('页面标题:', document.title);
  console.log('页面加载状态:', document.readyState);

  // 方法1: 使用具体的选择器
  const selectors = [
    'button[class*="sign"]',
    'a[class*="sign"]',
    'button[id*="sign"]',
    'a[id*="sign"]',
    '.sign-in-btn',
    '.signin-btn',
    '#signIn',
    '#sign_in',
    // 添加更多可能的选择器
    'button[class*="check"]',
    'a[class*="check"]',
    'button[class*="daily"]',
    'a[class*="daily"]',
    '.check-in',
    '.checkin',
    '.daily-sign',
    '.qiandao'
  ];

  console.log('🎯 尝试使用选择器查找按钮...');
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`✅ 找到按钮 (选择器: ${selector}):`, element);
      console.log('按钮文本:', element.textContent);
      console.log('按钮HTML:', element.outerHTML);
      return element;
    }
  }

  // 方法2: 查找所有按钮并分析
  console.log('🔄 使用文本匹配查找按钮...');
  const buttons = document.querySelectorAll('button, a, .btn, [role="button"]');
  console.log(`找到 ${buttons.length} 个可点击元素`);

  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const text = button.textContent.toLowerCase().trim();
    console.log(`按钮 ${i + 1}: "${text}" - ${button.tagName}`, button);

    if (text.includes('签到') ||
        text.includes('sign') ||
        text.includes('check') ||
        text.includes('打卡') ||
        text.includes('daily') ||
        text.includes('qiandao')) {
      console.log(`✅ 通过文本匹配找到按钮: "${text}"`, button);
      return button;
    }
  }

  // 方法3: 查找包含特定属性的元素
  console.log('🔍 查找包含签到相关属性的元素...');
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    const attrs = element.attributes;
    for (const attr of attrs) {
      if (attr.name.includes('sign') ||
          attr.value.includes('sign') ||
          attr.name.includes('check') ||
          attr.value.includes('check')) {
        console.log('🎯 找到包含签到属性的元素:', element, attr);
      }
    }
  }

  // 打印页面所有可能相关的元素
  console.log('📋 页面中所有可能的按钮元素:');
  buttons.forEach((btn, index) => {
    console.log(`按钮${index + 1}:`, {
      text: btn.textContent.trim(),
      tag: btn.tagName,
      class: btn.className,
      id: btn.id,
      element: btn
    });
  });

  console.log('❌ 未找到签到按钮');
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