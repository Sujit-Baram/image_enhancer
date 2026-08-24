# Image Enhancer Frontend — static files served by Nginx,
# reverse-proxying /api/ to the backend Compose service by name.

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css app.js /usr/share/nginx/html/

EXPOSE 80
