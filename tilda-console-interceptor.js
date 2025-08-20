// Скрипт для перехвата данных из консоли Tilda
(function() {
  // Сохраняем оригинальные методы консоли
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  
  // Функция для проверки объекта на наличие email
  function checkForEmail(data) {
    try {
      // Преобразуем данные в строку для анализа
      const dataStr = JSON.stringify(data);
      
      // Проверяем, содержит ли строка email
      if (dataStr.includes('@') && (dataStr.includes('Email') || dataStr.includes('email'))) {
        console.warn('Найдены данные с email:', data);
        
        // Извлекаем email из данных
        let email = null;
        
        // Проверяем разные форматы данных
        if (data && data.fields && data.fields.Email) {
          email = data.fields.Email;
        } else if (data && data.fields && data.fields.email) {
          email = data.fields.email;
        } else if (data && data.Email) {
          email = data.Email;
        } else if (data && data.email) {
          email = data.email;
        } else {
          // Если не нашли email в известных форматах, ищем в строке
          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
          const matches = dataStr.match(emailRegex);
          if (matches && matches.length > 0) {
            email = matches[0];
          }
        }
        
        if (email) {
          console.warn('Извлечен email:', email);
          
          // Отправляем email на ваш сервер
          sendEmailToServer(email, data);
        }
      }
    } catch (e) {
      // Игнорируем ошибки при анализе данных
    }
  }
  
  // Функция для отправки email на сервер
  function sendEmailToServer(email, originalData) {
    fetch('https://supabase-auth-production-4267.up.railway.app/get-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: email,
        source: 'console-interceptor',
        originalData: originalData
      })
    })
    .then(response => response.json())
    .then(data => {
      console.warn('Ответ от сервера:', data);
      
      // Если пользователь найден, можно выполнить дополнительные действия
      if (!data.error) {
        // Например, показать уведомление
        showNotification('Пользователь найден: ' + email);
        
        // Или сохранить информацию в localStorage
        localStorage.setItem('userVerified', 'true');
        localStorage.setItem('userEmail', email);
      }
    })
    .catch(error => {
      console.error('Ошибка при отправке данных на сервер:', error);
    });
  }
  
  // Функция для отображения уведомления
  function showNotification(message) {
    // Создаем элемент уведомления, если его еще нет
    let notification = document.getElementById('email-verification-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'email-verification-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      notification.style.padding = '15px';
      notification.style.borderRadius = '5px';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      notification.style.zIndex = '9999';
      notification.style.display = 'none';
      document.body.appendChild(notification);
    }
    
    // Устанавливаем текст и показываем уведомление
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Скрываем уведомление через 5 секунд
    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }
  
  // Переопределяем методы консоли для перехвата данных
  console.log = function() {
    // Проверяем аргументы на наличие email
    for (let i = 0; i < arguments.length; i++) {
      checkForEmail(arguments[i]);
    }
    
    // Вызываем оригинальный метод
    return originalConsoleLog.apply(console, arguments);
  };
  
  console.error = function() {
    // Проверяем аргументы на наличие email
    for (let i = 0; i < arguments.length; i++) {
      checkForEmail(arguments[i]);
    }
    
    // Вызываем оригинальный метод
    return originalConsoleError.apply(console, arguments);
  };
  
  console.warn = function() {
    // Проверяем аргументы на наличие email
    for (let i = 0; i < arguments.length; i++) {
      checkForEmail(arguments[i]);
    }
    
    // Вызываем оригинальный метод
    return originalConsoleWarn.apply(console, arguments);
  };
  
  console.info = function() {
    // Проверяем аргументы на наличие email
    for (let i = 0; i < arguments.length; i++) {
      checkForEmail(arguments[i]);
    }
    
    // Вызываем оригинальный метод
    return originalConsoleInfo.apply(console, arguments);
  };
  
  // Также перехватываем XHR запросы для поиска email
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function() {
    this._url = arguments[1];
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    // Проверяем, содержит ли отправляемые данные email
    if (data) {
      checkForEmail(data);
    }
    
    // Перехватываем ответ
    this.addEventListener('load', function() {
      try {
        const responseData = JSON.parse(this.responseText);
        checkForEmail(responseData);
      } catch (e) {
        // Игнорируем ошибки при парсинге ответа
      }
    });
    
    return originalXHRSend.apply(this, arguments);
  };
  
  // Также перехватываем fetch запросы
  const originalFetch = window.fetch;
  
  window.fetch = function(url, options) {
    // Проверяем, содержит ли отправляемые данные email
    if (options && options.body) {
      checkForEmail(options.body);
    }
    
    return originalFetch.apply(this, arguments)
      .then(response => {
        // Клонируем ответ, чтобы не нарушить его обработку
        const clone = response.clone();
        
        // Пытаемся прочитать и проверить данные ответа
        clone.json().then(data => {
          checkForEmail(data);
        }).catch(() => {
          // Игнорируем ошибки при парсинге ответа
        });
        
        return response;
      });
  };
  
  console.warn('Перехватчик данных активирован');
})();