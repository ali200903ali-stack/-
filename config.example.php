<?php
declare(strict_types=1);
/**
 * نسّخ هذا الملف إلى config.local.php وعدّل البيانات في Hostinger.
 * لا ترفع config.local.php إلى GitHub أبداً.
 */
return [
 'db_host' => 'localhost',
 'db_port' => '3306',
 'db_name' => 'u123456_ninesoft',
 'db_user' => 'u123456_user',
 'db_pass' => 'REPLACE_WITH_DATABASE_PASSWORD',
 'app_url' => 'https://accounting.example.com',
 'timezone' => 'Asia/Aden',
 'session_name' => 'NSSESSID',
 'install_token' => 'REPLACE_WITH_A_RANDOM_TOKEN_OF_AT_LEAST_32_CHARACTERS',
];
