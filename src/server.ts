import bcrypt from "bcryptjs";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "local-access-secret-change-me";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET ?? "local-refresh-secret-change-me";
const ACCESS_EXPIRES_IN = (process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type Booking = {
  id: string;
  userId: string;
  propertyTitle: string;
  city: string;
  address: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  status: "upcoming" | "completed" | "cancelled";
};

type AuthRequest = Request & { userId?: string };

const users: User[] = [
  {
    id: "user-anna",
    firstName: "Анна",
    lastName: "Волченкова",
    email: "anna@example.com",
    passwordHash: bcrypt.hashSync("password123", 10),
    phone: null,
    birthDate: null,
    avatarUrl: null,
    createdAt: "2026-06-01T10:00:00.000Z",
  },
];

const bookings: Booking[] = [];
const refreshTokens = new Set<string>();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get("/api/openapi.json", (_request, response) => response.json(openApiDocument));

function publicUser(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function createTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId, type: "access" }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
  const refreshToken = jwt.sign({ sub: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  refreshTokens.add(refreshToken);
  return { accessToken, refreshToken };
}

function getUserById(userId: string) {
  return users.find((user) => user.id === userId);
}

function getUserIdFromToken(token: string, secret: string, expectedType: "access" | "refresh") {
  const payload = jwt.verify(token, secret) as JwtPayload & { type?: string };
  if (payload.type !== expectedType || typeof payload.sub !== "string") {
    throw new Error("Invalid token type");
  }
  return payload.sub;
}

function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ message: "Требуется access-токен" });
    return;
  }

  try {
    request.userId = getUserIdFromToken(token, ACCESS_SECRET, "access");
    if (!getUserById(request.userId)) {
      response.status(401).json({ message: "Пользователь не найден" });
      return;
    }
    next();
  } catch {
    response.status(401).json({ message: "Access-токен недействителен или истёк" });
  }
}

function validateCredentials(email: unknown, password: unknown) {
  return typeof email === "string" && email.includes("@") && typeof password === "string" && password.length >= 6;
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "quarter-user-account-backend" });
});

app.post("/api/auth/register", (request, response) => {
  const { firstName, lastName, email, password } = request.body as Record<string, unknown>;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (typeof firstName !== "string" || !firstName.trim() || typeof lastName !== "string" || !lastName.trim()) {
    response.status(400).json({ message: "Укажите имя и фамилию" });
    return;
  }
  if (!validateCredentials(normalizedEmail, password)) {
    response.status(400).json({ message: "Введите корректную почту и пароль не короче 6 символов" });
    return;
  }
  if (users.some((user) => user.email === normalizedEmail)) {
    response.status(409).json({ message: "Пользователь с такой почтой уже существует" });
    return;
  }

  const user: User = {
    id: randomUUID(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password as string, 10),
    phone: null,
    birthDate: null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  response.status(201).json({ user: publicUser(user), tokens: createTokens(user.id) });
});

app.post("/api/auth/login", (request, response) => {
  const { email, password } = request.body as Record<string, unknown>;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = users.find((candidate) => candidate.email === normalizedEmail);

  if (!user || typeof password !== "string" || !bcrypt.compareSync(password, user.passwordHash)) {
    response.status(401).json({ message: "Неверная почта или пароль" });
    return;
  }
  response.json({ user: publicUser(user), tokens: createTokens(user.id) });
});

app.post("/api/auth/refresh", (request, response) => {
  const { refreshToken } = request.body as { refreshToken?: unknown };
  if (typeof refreshToken !== "string" || !refreshTokens.has(refreshToken)) {
    response.status(401).json({ message: "Refresh-токен недействителен" });
    return;
  }

  try {
    const userId = getUserIdFromToken(refreshToken, REFRESH_SECRET, "refresh");
    refreshTokens.delete(refreshToken);
    response.json({ tokens: createTokens(userId) });
  } catch {
    refreshTokens.delete(refreshToken);
    response.status(401).json({ message: "Refresh-токен истёк или недействителен" });
  }
});

app.post("/api/auth/logout", (request, response) => {
  const { refreshToken } = request.body as { refreshToken?: unknown };
  if (typeof refreshToken === "string") refreshTokens.delete(refreshToken);
  response.status(204).send();
});

app.get("/api/users/me", requireAuth, (request: AuthRequest, response) => {
  response.json({ user: publicUser(getUserById(request.userId!)!) });
});

app.patch("/api/users/me", requireAuth, (request: AuthRequest, response) => {
  const user = getUserById(request.userId!)!;
  const { firstName, lastName, phone, birthDate, avatarUrl } = request.body as Record<string, unknown>;

  if (firstName !== undefined && (typeof firstName !== "string" || !firstName.trim())) {
    response.status(400).json({ message: "Имя не может быть пустым" });
    return;
  }
  if (lastName !== undefined && (typeof lastName !== "string" || !lastName.trim())) {
    response.status(400).json({ message: "Фамилия не может быть пустой" });
    return;
  }
  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    response.status(400).json({ message: "Телефон должен быть строкой" });
    return;
  }

  if (typeof firstName === "string") user.firstName = firstName.trim();
  if (typeof lastName === "string") user.lastName = lastName.trim();
  if (typeof phone === "string" || phone === null) user.phone = phone;
  if (typeof birthDate === "string" || birthDate === null) user.birthDate = birthDate;
  if (typeof avatarUrl === "string" || avatarUrl === null) user.avatarUrl = avatarUrl;
  response.json({ user: publicUser(user) });
});

app.get("/api/users/me/stats", requireAuth, (request: AuthRequest, response) => {
  const user = getUserById(request.userId!)!;
  const userBookings = bookings.filter((booking) => booking.userId === user.id && booking.status !== "cancelled");
  const nights = userBookings.reduce((sum, booking) => sum + booking.nights, 0);
  response.json({
    stats: {
      totalSpent: userBookings.reduce((sum, booking) => sum + booking.totalPrice, 0),
      monthsOnService: Math.max(1, Math.floor((Date.now() - Date.parse(user.createdAt)) / (1000 * 60 * 60 * 24 * 30))),
      bookedNights: nights,
      reviewsWritten: 0,
      bookingsCount: userBookings.length,
      profileCompletion: [user.firstName, user.lastName, user.email, user.phone, user.birthDate, user.avatarUrl].filter(Boolean).length * 20,
    },
  });
});

app.get("/api/users/me/bookings", requireAuth, (request: AuthRequest, response) => {
  response.json({ bookings: bookings.filter((booking) => booking.userId === request.userId) });
});

app.post("/api/users/me/bookings", requireAuth, (request: AuthRequest, response) => {
  const { propertyTitle, city, address, checkIn, checkOut, nights, totalPrice } = request.body as Record<string, unknown>;
  if ([propertyTitle, city, address, checkIn, checkOut].some((value) => typeof value !== "string") || typeof nights !== "number" || typeof totalPrice !== "number") {
    response.status(400).json({ message: "Для бронирования нужны данные жилья, даты, количество суток и стоимость" });
    return;
  }
  const booking: Booking = {
    id: randomUUID(), userId: request.userId!, propertyTitle: propertyTitle as string, city: city as string,
    address: address as string, checkIn: checkIn as string, checkOut: checkOut as string, nights, totalPrice, status: "upcoming",
  };
  bookings.push(booking);
  response.status(201).json({ booking });
});

app.delete("/api/users/me/bookings/:bookingId", requireAuth, (request: AuthRequest, response) => {
  const booking = bookings.find((item) => item.id === request.params.bookingId && item.userId === request.userId);
  if (!booking) {
    response.status(404).json({ message: "Бронирование не найдено" });
    return;
  }
  booking.status = "cancelled";
  response.json({ booking });
});

app.use((_request, response) => response.status(404).json({ message: "Маршрут не найден" }));

app.listen(PORT, () => {
  console.log(`User Account backend is running at http://localhost:${PORT}`);
});
