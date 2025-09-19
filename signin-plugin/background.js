chrome.runtime.onStartup.addListener(() => {
  console.log('浏览器启动，检查是否需要签到');
  checkAndSignIn();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('插件安装完成');
  checkAndSignIn();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retrySignIn') {
    console.log('重试签到');
    checkAndSignIn();
  }
});

async function checkAndSignIn() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['lastSignInDate', 'signInStatus']);

    if (result.lastSignInDate === today && result.signInStatus === 'success') {
      console.log('今天已经签到成功，跳过');
      return;
    }

    await performSignIn();
  } catch (error) {
    console.error('检查签到状态失败:', error);
  }
}

async function performSignIn() {
  try {
    // 直接打开个人设置页面进行签到
    const targetUrl = 'https://hk.ikuncode.cc/app/me';

    const [tab] = await chrome.tabs.query({
      url: 'https://hk.ikuncode.cc/*'
    });

    let targetTab;
    if (tab) {
      // 如果已有标签页，导航到个人设置页面
      await chrome.tabs.update(tab.id, { url: targetUrl });
      targetTab = tab;
    } else {
      // 创建新标签页并打开个人设置页面
      targetTab = await chrome.tabs.create({
        url: targetUrl,
        active: false
      });
    }

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 5000));

    const credentials = await chrome.storage.local.get(['username', 'password']);

    if (credentials.username && credentials.password) {
      console.log('尝试自动登录');
      await chrome.tabs.sendMessage(targetTab.id, {
        action: 'performLogin',
        credentials: {
          username: credentials.username,
          password: credentials.password
        }
      });

      // 等待登录完成
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 执行签到
    await chrome.tabs.sendMessage(targetTab.id, {
      action: 'performSignIn'
    });

  } catch (error) {
    console.error('执行签到失败:', error);
    await scheduleRetry();
  }
}

async function scheduleRetry() {
  chrome.alarms.clear('retrySignIn');
  chrome.alarms.create('retrySignIn', {
    delayInMinutes: 10
  });
  console.log('已安排10分钟后重试签到');
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'manualSignIn') {
    console.log('收到手动签到请求');
    await performSignIn();
    return;
  }

  if (message.action === 'loginResult') {
    console.log('登录结果:', message.success ? '成功' : '失败', message.message);

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      title: 'iKunCode登录助手',
      message: message.success ? '自动登录成功' : '自动登录失败: ' + message.message
    });

    return;
  }

  if (message.action === 'signInResult') {
    const today = new Date().toDateString();

    await chrome.storage.local.set({
      lastSignInDate: today,
      signInStatus: message.success ? 'success' : 'failed',
      lastSignInTime: new Date().toISOString(),
      message: message.message
    });

    if (message.success) {
      chrome.alarms.clear('retrySignIn');
      console.log('签到成功，清除重试任务');

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        title: 'iKunCode签到助手',
        message: '签到成功！' + (message.message || '')
      });
    } else {
      console.log('签到失败，安排重试');
      await scheduleRetry();

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        title: 'iKunCode签到助手',
        message: '签到失败，10分钟后重试：' + (message.message || '')
      });
    }
  }
});