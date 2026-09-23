FROM php:8.4-cli

# Install system dependencies for Postgres and Zip
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy application files
COPY . .

# Install dependencies without running post-autoload scripts
RUN composer install --no-dev --optimize-autoloader --no-scripts

ENV PORT=8000

# Run migrations and start server on launch
CMD sh -c "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=$PORT"