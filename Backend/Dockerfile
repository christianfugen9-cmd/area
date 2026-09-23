FROM php:8.2-cli

# Install dependencies for Postgres and Zip
RUN apt-get update && apt-get install -y libpq-dev libzip-dev unzip \
    && docker-php-ext-install pdo pdo_pgsql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

RUN composer install --no-dev --optimize-autoloader

# Automatically run migrations on startup before serving
CMD sh -c "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=$PORT"