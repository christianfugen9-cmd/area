FROM php:8.2-cli

# Install system dependencies
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

# Install PHP dependencies without running post-autoload-dump scripts
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Set port default
ENV PORT=8000

# Run migrations and start server on container run
CMD sh -c "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=$PORT"