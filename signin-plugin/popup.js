document.addEventListener('DOMContentLoaded', async () => {
  await loadSignInStatus();
  await loadCredentials();
  setupEventListeners();
});

async function loadCredentials() {
  try {
    const result = await chrome.storage.local.get(['username', 'password']);

    if (result.username) {
      document.getElementById('usernameInput').value = result.username;
    }
    if (result.password) {
      document.getElementById('passwordInput').value = result.password;
    }
  } catch (error) {
    console.error('加载账户信息失败:', error);
  }
}

async function loadSignInStatus() {
  try {
    const result = await chrome.storage.local.get([
      'lastSignInDate',
      'lastSignInTime',
      'signInStatus',
      'message'
    ]);

    const lastSignInTimeElement = document.getElementById('lastSignInTime');
    const signInStatusElement = document.getElementById('signInStatus');
    const messageElement = document.getElementById('message');
    const messageCard = document.getElementById('messageCard');
    const signInStatusCard = document.getElementById('signInStatusCard');

    if (result.lastSignInTime) {
      const date = new Date(result.lastSignInTime);
      lastSignInTimeElement.textContent = formatDateTime(date);
    } else {
      lastSignInTimeElement.textContent = '从未签到';
    }

    if (result.signInStatus) {
      const isSuccess = result.signInStatus === 'success';
      signInStatusElement.textContent = isSuccess ? '签到成功' : '签到失败';

      signInStatusCard.classList.remove('success', 'failed');
      signInStatusCard.classList.add(isSuccess ? 'success' : 'failed');

      const today = new Date().toDateString();
      if (result.lastSignInDate === today && isSuccess) {
        document.getElementById('signInNowBtn').disabled = true;
        document.getElementById('signInNowBtn').textContent = '今日已签到';
      }
    } else {
      signInStatusElement.textContent = '等待签到';
    }

    if (result.message) {
      messageElement.textContent = result.message;
      messageCard.style.display = 'block';
    }

  } catch (error) {
    console.error('加载签到状态失败:', error);
    document.getElementById('signInStatus').textContent = '状态未知';
  }
}

function setupEventListeners() {
  document.getElementById('signInNowBtn').addEventListener('click', async () => {
    const button = document.getElementById('signInNowBtn');
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = '签到中...';

    try {
      await chrome.runtime.sendMessage({ action: 'manualSignIn' });

      setTimeout(async () => {
        await loadSignInStatus();
        button.disabled = false;
        button.textContent = originalText;
      }, 3000);

    } catch (error) {
      console.error('手动签到失败:', error);
      button.disabled = false;
      button.textContent = originalText;

      showNotification('签到失败: ' + error.message);
    }
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    const statusContainer = document.getElementById('statusContainer');
    const settingsContainer = document.getElementById('settingsContainer');
    const settingsBtn = document.getElementById('settingsBtn');

    if (settingsContainer.style.display === 'none') {
      statusContainer.style.display = 'none';
      settingsContainer.style.display = 'block';
      settingsBtn.textContent = '返回状态';
    } else {
      statusContainer.style.display = 'block';
      settingsContainer.style.display = 'none';
      settingsBtn.textContent = '账户设置';
    }
  });

  document.getElementById('saveCredentialsBtn').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();

    if (!username || !password) {
      showNotification('请输入用户名和密码');
      return;
    }

    try {
      await chrome.storage.local.set({
        username: username,
        password: password
      });

      showNotification('账户信息已保存');

      setTimeout(() => {
        document.getElementById('settingsBtn').click();
      }, 1000);

    } catch (error) {
      console.error('保存账户信息失败:', error);
      showNotification('保存失败: ' + error.message);
    }
  });

  document.getElementById('clearCredentialsBtn').addEventListener('click', async () => {
    if (confirm('确定要清除保存的账户信息吗？')) {
      try {
        await chrome.storage.local.remove(['username', 'password']);

        document.getElementById('usernameInput').value = '';
        document.getElementById('passwordInput').value = '';

        showNotification('账户信息已清除');

      } catch (error) {
        console.error('清除账户信息失败:', error);
        showNotification('清除失败: ' + error.message);
      }
    }
  });

  document.getElementById('openSiteBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://hk.ikuncode.cc' });
    window.close();
  });
}

function formatDateTime(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let dateStr;
  if (targetDate.getTime() === today.getTime()) {
    dateStr = '今天';
  } else if (targetDate.getTime() === today.getTime() - 86400000) {
    dateStr = '昨天';
  } else {
    dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
  }

  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return `${dateStr} ${timeStr}`;
}

function showNotification(message) {
  const messageCard = document.getElementById('messageCard');
  const messageElement = document.getElementById('message');

  messageElement.textContent = message;
  messageCard.style.display = 'block';

  setTimeout(() => {
    messageCard.style.display = 'none';
  }, 5000);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'signInResult') {
    setTimeout(() => loadSignInStatus(), 500);
  }
});