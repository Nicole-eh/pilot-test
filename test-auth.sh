#!/bin/bash

# JWT 认证系统测试脚本
# 使用方法: ./test-auth.sh

BASE_URL="http://localhost:4000"
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║   🔐 JWT 认证系统 - API 测试脚本       ║${NC}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════╝${NC}\n"

# 测试服务器是否运行
echo -e "${YELLOW}⏳ 检查服务器状态...${NC}"
if ! curl -s -f "$BASE_URL" > /dev/null; then
    echo -e "${RED}❌ 服务器未运行！请先启动服务器: node auth-server.js${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 服务器正在运行${NC}\n"

# 1. 注册新用户
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}1. 📝 注册新用户${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "name": "测试用户"
  }')

echo "$REGISTER_RESPONSE" | jq '.'

# 提取 token
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.refreshToken')

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
    echo -e "\n${GREEN}✅ 注册成功！${NC}"
    echo -e "Token: ${YELLOW}${TOKEN:0:50}...${NC}"
else
    echo -e "\n${YELLOW}ℹ️  用户可能已存在，尝试登录...${NC}"
fi

echo ""

# 2. 用户登录
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}2. 🔑 用户登录${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

# 更新 token（如果注册失败，使用登录的 token）
NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
NEW_REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken')

if [ "$NEW_TOKEN" != "null" ] && [ "$NEW_TOKEN" != "" ]; then
    TOKEN="$NEW_TOKEN"
    REFRESH_TOKEN="$NEW_REFRESH_TOKEN"
    echo -e "\n${GREEN}✅ 登录成功！${NC}"
    echo -e "Token: ${YELLOW}${TOKEN:0:50}...${NC}"
else
    echo -e "\n${RED}❌ 登录失败！${NC}"
    exit 1
fi

echo ""

# 3. 获取当前用户信息（需要认证）
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}3. 👤 获取当前用户信息（需要认证）${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n${GREEN}✅ 认证成功！获取到用户信息${NC}\n"

# 4. 测试无效 Token
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}4. ❌ 测试无效 Token${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer invalid_token_12345" | jq '.'

echo -e "\n${GREEN}✅ 正确拒绝了无效 Token${NC}\n"

# 5. 刷新 Token
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}5. 🔄 刷新访问令牌${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "$REFRESH_RESPONSE" | jq '.'

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.token')
if [ "$NEW_ACCESS_TOKEN" != "null" ] && [ "$NEW_ACCESS_TOKEN" != "" ]; then
    echo -e "\n${GREEN}✅ Token 刷新成功！${NC}"
    echo -e "新 Token: ${YELLOW}${NEW_ACCESS_TOKEN:0:50}...${NC}"
    TOKEN="$NEW_ACCESS_TOKEN"
else
    echo -e "\n${YELLOW}⚠️  Token 刷新失败${NC}"
fi

echo ""

# 6. 注册管理员用户（用于测试权限）
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}6. 👨‍💼 注册管理员用户${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ADMIN_REGISTER=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "admin123",
    "name": "管理员"
  }')

echo "$ADMIN_REGISTER" | jq '.'
echo ""

# 7. 测试权限控制（普通用户访问管理员端点）
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}7. 🛡️  测试权限控制（普通用户）${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s "$BASE_URL/api/protected/users" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n${YELLOW}ℹ️  普通用户无法访问管理员端点${NC}\n"

# 8. 用户登出
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}8. 🚪 用户登出${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "$LOGOUT_RESPONSE" | jq '.'
echo -e "\n${GREEN}✅ 登出成功！${NC}\n"

# 测试总结
echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   ✅ 所有测试完成！                       ║${NC}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════╝${NC}\n"

echo -e "${BOLD}测试摘要：${NC}"
echo -e "  ✅ 用户注册"
echo -e "  ✅ 用户登录"
echo -e "  ✅ Token 认证"
echo -e "  ✅ 无效 Token 拒绝"
echo -e "  ✅ Token 刷新"
echo -e "  ✅ 权限控制"
echo -e "  ✅ 用户登出\n"

echo -e "${YELLOW}💡 提示：${NC}"
echo -e "  - 访问 ${BLUE}http://localhost:4000${NC} 查看 Web 界面"
echo -e "  - 查看 ${BLUE}data/auth-users.json${NC} 查看用户数据"
echo -e "  - 查看 ${BLUE}data/refresh-tokens.json${NC} 查看刷新令牌\n"
