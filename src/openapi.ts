export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Квартал — User Account API",
    version: "1.0.0",
    description: "Учебный backend для авторизации и личного кабинета пользователя сервиса посуточной аренды жилья.",
  },
  servers: [{ url: "http://localhost:3000", description: "Локальный сервер" }],
  tags: [
    { name: "Auth", description: "Регистрация, вход и жизненный цикл токенов" },
    { name: "User", description: "Профиль и данные текущего пользователя" },
    { name: "Bookings", description: "Бронирования текущего пользователя" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "user-anna" },
          firstName: { type: "string", example: "Анна" },
          lastName: { type: "string", example: "Волченкова" },
          email: { type: "string", format: "email", example: "anna@example.com" },
          phone: { type: "string", nullable: true, example: "+7 900 000-00-00" },
          birthDate: { type: "string", nullable: true, example: "2003-05-12" },
          avatarUrl: { type: "string", nullable: true, example: "https://example.com/avatar.jpg" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Tokens: {
        type: "object",
        required: ["accessToken", "refreshToken"],
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          tokens: { $ref: "#/components/schemas/Tokens" },
        },
      },
      Booking: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          propertyTitle: { type: "string", example: "Светлая квартира у центра" },
          city: { type: "string", example: "Москва" },
          address: { type: "string", example: "ул. Тверская, 10" },
          checkIn: { type: "string", format: "date" },
          checkOut: { type: "string", format: "date" },
          nights: { type: "number", example: 4 },
          totalPrice: { type: "number", example: 24000 },
          status: { type: "string", enum: ["upcoming", "completed", "cancelled"] },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["Auth"],
        summary: "Проверить работоспособность сервера",
        responses: { "200": { description: "Сервер работает" } },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Зарегистрировать пользователя",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
        },
        responses: {
          "201": { description: "Пользователь создан", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
          "400": { $ref: "#/components/responses/BadRequest" },
          "409": { description: "Почта уже используется" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Войти в аккаунт",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
        responses: {
          "200": { description: "Вход выполнен", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
          "401": { description: "Неверная почта или пароль" },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Обновить пару токенов",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } } },
        responses: { "200": { description: "Токены обновлены" }, "401": { description: "Refresh-токен недействителен" } },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Выйти из аккаунта",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } } },
        responses: { "204": { description: "Refresh-токен отозван" } },
      },
    },
    "/api/users/me": {
      get: {
        tags: ["User"], security: [{ bearerAuth: [] }], summary: "Получить текущего пользователя",
        responses: { "200": { description: "Профиль пользователя" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      patch: {
        tags: ["User"], security: [{ bearerAuth: [] }], summary: "Частично обновить профиль",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProfilePatch" } } } },
        responses: { "200": { description: "Профиль обновлён" }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
    "/api/users/me/stats": {
      get: {
        tags: ["User"], security: [{ bearerAuth: [] }], summary: "Получить статистику кабинета",
        responses: { "200": { description: "Статистика пользователя" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
    "/api/users/me/bookings": {
      get: {
        tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "Получить бронирования пользователя",
        responses: { "200": { description: "Массив бронирований" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      post: {
        tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "Добавить учебное бронирование",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BookingRequest" } } } },
        responses: { "201": { description: "Бронирование создано" }, "400": { $ref: "#/components/responses/BadRequest" } },
      },
    },
    "/api/users/me/bookings/{bookingId}": {
      delete: {
        tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "Отменить бронирование",
        parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Бронирование отменено" }, "404": { description: "Бронирование не найдено" } },
      },
    },
  },
};

Object.assign(openApiDocument.components.schemas, {
  RegisterRequest: {
    type: "object", required: ["firstName", "lastName", "email", "password"],
    properties: {
      firstName: { type: "string", example: "Анна" }, lastName: { type: "string", example: "Волченкова" },
      email: { type: "string", format: "email", example: "anna@example.com" }, password: { type: "string", format: "password", example: "password123" },
    },
  },
  LoginRequest: {
    type: "object", required: ["email", "password"],
    properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } },
  },
  RefreshRequest: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
  ProfilePatch: {
    type: "object",
    properties: {
      firstName: { type: "string" }, lastName: { type: "string" }, phone: { type: "string", nullable: true },
      birthDate: { type: "string", nullable: true }, avatarUrl: { type: "string", nullable: true },
    },
  },
  BookingRequest: {
    type: "object", required: ["propertyTitle", "city", "address", "checkIn", "checkOut", "nights", "totalPrice"],
    properties: {
      propertyTitle: { type: "string" }, city: { type: "string" }, address: { type: "string" },
      checkIn: { type: "string", format: "date" }, checkOut: { type: "string", format: "date" },
      nights: { type: "number", minimum: 1 }, totalPrice: { type: "number", minimum: 0 },
    },
  },
});

Object.assign(openApiDocument.components, {
  responses: {
    BadRequest: { description: "Некорректные данные запроса" },
    Unauthorized: { description: "Требуется действительный access-токен" },
  },
});
