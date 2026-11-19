FROM richarvey/nginx-php-fpm:latest

COPY . .

ENV WEBROOT=/var/www/html/public
ENV APP_ENV=production
ENV APP_DEBUG=false
ENV LOG_CHANNEL=stderr
ENV COMPOSER_ALLOW_SUPERUSER=1

RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache \
    && sed -i 's/listen 80;/listen 7860;/g' /etc/nginx/sites-available/default.conf

EXPOSE 7860

CMD ["/start.sh"]