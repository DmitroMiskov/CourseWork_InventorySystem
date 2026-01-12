# Етап 1: Збірка Node.js
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Етап 2: Сервер Nginx
FROM nginx:alpine
# Копіюємо зібраний React у папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Копіюємо наш конфіг
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
