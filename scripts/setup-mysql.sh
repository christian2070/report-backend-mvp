#!/bin/bash
# Script para configurar MySQL do zero (Ubuntu)
# Rode no terminal: bash scripts/setup-mysql.sh

set -e

echo "=== Setup MySQL - Cidades Inteligentes ==="
echo ""
echo "Você vai precisar digitar a SENHA DO SEU LINUX (sudo), não é senha do MySQL."
echo ""

sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS cidades_inteligentes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'cidades'@'localhost' IDENTIFIED BY 'cidades123';

GRANT ALL PRIVILEGES ON cidades_inteligentes.* TO 'cidades'@'localhost';

FLUSH PRIVILEGES;

SELECT 'Banco e usuário criados com sucesso!' AS resultado;
SQL

echo ""
echo "Pronto! Agora rode:"
echo "  npm run start:dev"
echo "  npm run seed"
echo ""
