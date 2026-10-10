# Квартал — локальный backend личного кабинета

Учебный API для проекта User Account. Данные хранятся в памяти процесса: после перезапуска сервера они возвращаются к начальному состоянию.

## Запуск

```bash
npm install
npm run dev
```

Сервер: `http://localhost:3000`  
Проверка: `GET http://localhost:3000/api/health`

Документация Swagger UI: `http://localhost:3000/api/docs`  
OpenAPI JSON: `http://localhost:3000/api/openapi.json`

Демо-пользователь:

```text
email: anna@example.com
password: password123
```

## Основные маршруты

### Публичные

- `POST /api/auth/register` — регистрация;
- `POST /api/auth/login` — вход;
- `POST /api/auth/refresh` — получение новой пары токенов;
- `POST /api/auth/logout` — отзыв refresh-токена.

### Защищённые

Передавайте access-токен в заголовке:

```text
Authorization: Bearer <accessToken>
```

- `GET /api/users/me` — текущий пользователь;
- `PATCH /api/users/me` — частичное обновление профиля;
- `GET /api/users/me/stats` — статистика кабинета;
- `GET /api/users/me/bookings` — бронирования пользователя;
- `POST /api/users/me/bookings` — добавить учебное бронирование;
- `DELETE /api/users/me/bookings/:bookingId` — отменить бронирование.

Регистрация принимает `firstName`, `lastName`, `email`, `password`. Для изменения профиля можно передать `firstName`, `lastName`, `phone`, `birthDate`, `avatarUrl`.
