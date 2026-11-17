FROM richarvey/nginx-php-fpm:latest
COPY . .
ENV WEBROOT /var/www/html/public
ENV APP_ENV production
ENV APP_DEBUG false
ENV LOG_CHANNEL stderr
ENV COMPOSER_ALLOW_SUPERUSER 1
CMD ["/start.sh"]
