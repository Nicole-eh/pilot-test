#!/bin/bash

# JWT 认证功能测试脚本
# 用法: bash test-auth.sh

BASE_URL="http://localhost:3000"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}   JWT 认证功能完整测试${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# --------------------------------------------------
# 1. 用户注册
# --------------------------------------------------
echo -e "${CYAN}[1/12] 注册普通用户 testuser${NC}"
REGISTER_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}')
echo "$REGISTER_RESULT" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESULT"
echo ""

echo -e "${CYAN}[2/12] 注册管理员 admin${NC}"
REGISTER_ADMIN=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","role":"admin"}')
echo "$REGISTER_ADMIN" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_ADMIN"
echo ""

echo -e "${CYAN}[3/12] 重复注册（应失败）${NC}"
DUP_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}')
echo "$DUP_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DUP_RESULT"
echo ""

echo -e "${CYAN}[4/12] 密码过短（应失败）${NC}"
SHORT_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"baduser","password":"123"}')
echo "$SHORT_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SHORT_RESULT"
echo ""

# --------------------------------------------------
# 2. 用户登录
# --------------------------------------------------
echo -e "${CYAN}[5/12] 普通用户登录${NC}"
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}')
echo "$LOGIN_RESULT" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESULT"
echo ""

# 提取 Token
ACCESS_TOKEN=$(echo "$LOGIN_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}[ERROR] 无法提取 Token，请确保服务器正在运行${NC}"
  exit 1
fi

echo -e "${GREEN}  -> Access Token: ${ACCESS_TOKEN:0:30}...${NC}"
echo -e "${GREEN}  -> Refresh Token: ${REFRESH_TOKEN:0:30}...${NC}"
echo ""

echo -e "${CYAN}[6/12] 错误密码登录（应失败）${NC}"
BAD_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"wrongpass"}')
echo "$BAD_LOGIN" | python3 -m json.tool 2>/dev/null || echo "$BAD_LOGIN"
echo ""

# --------------------------------------------------
# 3. 受保护路由
# --------------------------------------------------
echo -e "${CYAN}[7/12] 不带 Token 访问 profile（应 401）${NC}"
NO_TOKEN=$(curl -s "$BASE_URL/api/auth/profile")
echo "$NO_TOKEN" | python3 -m json.tool 2>/dev/null || echo "$NO_TOKEN"
echo ""

echo -e "${CYAN}[8/12] 带 Token 访问 profile（应成功）${NC}"
PROFILE=$(curl -s "$BASE_URL/api/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$PROFILE" | python3 -m json.tool 2>/dev/null || echo "$PROFILE"
echo ""

# --------------------------------------------------
# 4. Token 刷新
# --------------------------------------------------
echo -e "${CYAN}[9/12] 刷新 Token${NC}"
REFRESH_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
echo "$REFRESH_RESULT" | python3 -m json.tool 2>/dev/null || echo "$REFRESH_RESULT"
echo ""

NEW_ACCESS=$(echo "$REFRESH_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
echo -e "${GREEN}  -> New Access Token: ${NEW_ACCESS:0:30}...${NC}"
echo ""

# --------------------------------------------------
# 5. 角色权限控制
# --------------------------------------------------
echo -e "${CYAN}[10/12] 普通用户访问 admin 接口（应 403）${NC}"
FORBIDDEN=$(curl -s "$BASE_URL/api/auth/accounts" \
  -H "Authorization: Bearer $NEW_ACCESS")
echo "$FORBIDDEN" | python3 -m json.tool 2>/dev/null || echo "$FORBIDDEN"
echo ""

# 管理员登录
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

echo -e "${CYAN}[11/12] admin 查看所有账号（应成功）${NC}"
ACCOUNTS=$(curl -s "$BASE_URL/api/auth/accounts" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$ACCOUNTS" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNTS"
echo ""

# --------------------------------------------------
# 6. 退出登录
# --------------------------------------------------
echo -e "${CYAN}[12/12] 退出登录（撤销 Refresh Token）${NC}"
LOGOUT=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
echo "$LOGOUT" | python3 -m json.tool 2>/dev/null || echo "$LOGOUT"
echo ""

echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}  所有测试完成！${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
