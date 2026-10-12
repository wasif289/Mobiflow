# Laravel on FrankenPHP (Caddy + PHP in one process). Serves /app/public on port 80 inside the Docker network.
FROM dunglas/frankenphp:1-php8.4
RUN install-php-extensions pdo_pgsql intl zip opcache bcmath
WORKDIR /app
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-interaction \
 && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache
ENV SERVER_NAME=:80 APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr
USER www-data
