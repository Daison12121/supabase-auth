// Скрипт для исправления проблемы с входом в кабинет
(function() {
  console.log('Скрипт исправления входа в кабинет активирован');
  
  // Сохраняем оригинальные методы localStorage
  const originalSetItem = localStorage.setItem;
  const originalGetItem = localStorage.getItem;
  
  // Флаг для предотвращения рекурсии
  let isProcessingSetItem = false;
  
  // Переопределяем метод setItem
  localStorage.setItem = function(key, value) {
    // Если уже обрабатываем setItem, используем оригинальный метод напрямую
    if (isProcessingSetItem) {
      console.log('Предотвращена рекурсия при записи в localStorage:', key);
      return Object.getPrototypeOf(localStorage).setItem.call(localStorage, key, value);
    }
    
    // Устанавливаем флаг, что обрабатываем setItem
    isProcessingSetItem = true;
    
    try {
      console.log('Безопасная запись в localStorage:', key);
      
      // Вызываем оригинальный метод
      originalSetItem.call(localStorage, key, value);
      
      // Если это userEmail, сохраняем также в cookie для резервного доступа
      if (key === 'userEmail') {
        document.cookie = `userEmail=${encodeURIComponent(value)}; path=/; max-age=86400`;
      }
    } catch (error) {
      console.error('Ошибка при записи в localStorage:', error);
      
      // В случае ошибки, пытаемся использовать cookie
      if (key === 'userEmail') {
        document.cookie = `userEmail=${encodeURIComponent(value)}; path=/; max-age=86400`;
      }
    } finally {
      // Сбрасываем флаг
      isProcessingSetItem = false;
    }
  };
  
  // Переопределяем метод getItem
  localStorage.getItem = function(key) {
    try {
      // Вызываем оригинальный метод
      return originalGetItem.call(localStorage, key);
    } catch (error) {
      console.error('Ошибка при чтении из localStorage:', error);
      
      // В случае ошибки, пытаемся использовать cookie
      if (key === 'userEmail') {
        return getCookie('userEmail');
      }
      
      return null;
    }
  };
  
  // Функция для получения cookie
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  }
  
  // Функция для безопасного входа в кабинет
  function safeLogin() {
    // Получаем email из localStorage или cookie
    const userEmail = localStorage.getItem('userEmail') || getCookie('userEmail');
    
    if (!userEmail) {
      console.log('Email пользователя не найден, вход невозможен');
      return;
    }
    
    console.log('Выполняем безопасный вход для:', userEmail);
    
    // Перенаправляем на страницу кабинета
    const cabinetUrl = '/cabinet' || '/members/cabinet' || '/account';
    
    // Добавляем параметр email для идентификации пользователя
    window.location.href = `${cabinetUrl}?email=${encodeURIComponent(userEmail)}`;
  }
  
  // Добавляем кнопку безопасного входа
  function addSafeLoginButton() {
    // Проверяем, существует ли уже кнопка
    if (document.getElementById('safe-login-button')) {
      return;
    }
    
    // Создаем кнопку
    const button = document.createElement('button');
    button.id = 'safe-login-button';
    button.textContent = 'Войти в кабинет';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '9999';
    
    // Добавляем обработчик клика
    button.addEventListener('click', safeLogin);
    
    // Добавляем кнопку на страницу
    document.body.appendChild(button);
  }
  
  // Функция инициализации
  function init() {
    // Добавляем кнопку безопасного входа
    addSafeLoginButton();
    
    // Если в URL есть параметр redirecturl=cabinet, выполняем безопасный вход
    if (window.location.search.includes('redirecturl=cabinet')) {
      // Даем время для загрузки страницы и инициализации других скриптов
      setTimeout(safeLogin, 1000);
    }
  }
  
  // Запускаем инициализацию при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();