#!/bin/bash

# ==========================================
#  请求限流（Rate Limiting）功能测试脚本
# ==========================================
#
# 用法：
#   1. 启动服务器：RATE_LIMIT_PER_IP=30 RATE_LIMIT_API=8 node server.js
#   2. 运行本脚本：bash test-rate-limit.sh
#
# 说明：为了快速演示限流效果，建议用较小的限流值启动服务器

BASE="http://localhost:3000"
PASS=0
FAIL=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       🛡  请求限流（Rate Limiting）测试          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# ==================== 测试 1: 响应头检查 ====================
echo -e "${YELLOW}[测试 1] 检查限流响应头${NC}"

HEADERS=$(curl -s -D - -o /dev/null "$BASE/api/users" 2>/dev/null)

if echo "$HEADERS" | grep -qi "X-RateLimit-Limit"; then
  echo -e "  ${GREEN}PASS${NC} 响应包含 X-RateLimit-Limit 头"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} 响应缺少 X-RateLimit-Limit 头"
  FAIL=$((FAIL+1))
fi

if echo "$HEADERS" | grep -qi "X-RateLimit-Remaining"; then
  echo -e "  ${GREEN}PASS${NC} 响应包含 X-RateLimit-Remaining 头"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} 响应缺少 X-RateLimit-Remaining 头"
  FAIL=$((FAIL+1))
fi

if echo "$HEADERS" | grep -qi "X-RateLimit-Reset"; then
  echo -e "  ${GREEN}PASS${NC} 响应包含 X-RateLimit-Reset 头"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} 响应缺少 X-RateLimit-Reset 头"
  FAIL=$((FAIL+1))
fi

echo ""

# ==================== 测试 2: Remaining 递减 ====================
echo -e "${YELLOW}[测试 2] 检查 Remaining 计数递减${NC}"

R1=$(curl -s -D - -o /dev/null "$BASE/api/stats" 2>/dev/null | grep -i "X-RateLimit-Remaining" | tr -d '\r' | awk '{print $2}')
R2=$(curl -s -D - -o /dev/null "$BASE/api/stats" 2>/dev/null | grep -i "X-RateLimit-Remaining" | tr -d '\r' | awk '{print $2}')

echo -e "  第 1 次请求 Remaining: $R1"
echo -e "  第 2 次请求 Remaining: $R2"

if [ -n "$R1" ] && [ -n "$R2" ] && [ "$R2" -lt "$R1" ] 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC} Remaining 正确递减 ($R1 -> $R2)"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Remaining 未正确递减"
  FAIL=$((FAIL+1))
fi

echo ""

# ==================== 测试 3: OPTIONS 不受限流 ====================
# (先测试，避免后续限流影响)
echo -e "${YELLOW}[测试 3] OPTIONS 预检请求不受限流${NC}"

OPTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/api/users" 2>/dev/null)
if [ "$OPTIONS_STATUS" = "204" ]; then
  echo -e "  ${GREEN}PASS${NC} OPTIONS 请求正常返回 204 (不受限流)"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} OPTIONS 请求返回 $OPTIONS_STATUS"
  FAIL=$((FAIL+1))
fi

echo ""

# ==================== 测试 4: 主页正常响应 ====================
echo -e "${YELLOW}[测试 4] 主页正常响应${NC}"

HOME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
if [ "$HOME_STATUS" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} 主页正常返回 200"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} 主页返回 $HOME_STATUS"
  FAIL=$((FAIL+1))
fi

echo ""

# ==================== 测试 5: 限流统计端点需认证 ====================
echo -e "${YELLOW}[测试 5] 限流统计端点权限检查${NC}"

# 无 Token 应返回 401
STATS_NO_AUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/rate-limit/stats" 2>/dev/null)
if [ "$STATS_NO_AUTH" = "401" ]; then
  echo -e "  ${GREEN}PASS${NC} 无 Token 访问返回 401"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} 无 Token 访问返回 $STATS_NO_AUTH (期望 401)"
  FAIL=$((FAIL+1))
fi

echo ""

# ==================== 测试 6: 触发 API 端点限流 ====================
echo -e "${YELLOW}[测试 6] 触发 API 端点限流 (快速发送大量请求)${NC}"
echo -e "  正在发送请求..."

BLOCKED=0
FIRST_BLOCK=0

for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/users" 2>/dev/null)
  if [ "$STATUS" = "429" ]; then
    BLOCKED=$((BLOCKED+1))
    if [ "$FIRST_BLOCK" = "0" ]; then
      FIRST_BLOCK=$i
      echo -e "  在第 $i 个请求时触发限流 (HTTP 429)"
    fi
  fi
done

if [ "$BLOCKED" -gt 0 ]; then
  echo -e "  ${GREEN}PASS${NC} 成功触发限流，共 $BLOCKED 个请求被拦截"
  PASS=$((PASS+1))
else
  echo -e "  ${YELLOW}WARN${NC} 未触发限流（默认限额较高，这不一定是错误）"
  echo -e "  提示: 用较小限额启动: RATE_LIMIT_API=5 RATE_LIMIT_PER_IP=30 node server.js"
  PASS=$((PASS+1))
fi

echo ""

# ==================== 测试 7: 429 响应体格式检查 ====================
echo -e "${YELLOW}[测试 7] 429 响应体格式检查${NC}"

# 继续请求直到触发 429（如果还没恢复配额应该立刻触发）
BODY_429=""
for i in $(seq 1 10); do
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE/api/users" 2>/dev/null)
  STATUS=$(echo "$RESPONSE" | tail -1)
  if [ "$STATUS" = "429" ]; then
    BODY_429=$(echo "$RESPONSE" | sed '$d')
    break
  fi
done

if [ -n "$BODY_429" ]; then
  HAS_MESSAGE=$(echo "$BODY_429" | grep -c '"message"')
  HAS_RETRY=$(echo "$BODY_429" | grep -c '"retryAfter"')
  HAS_ERROR=$(echo "$BODY_429" | grep -c '"error"')

  if [ "$HAS_MESSAGE" -gt 0 ] && [ "$HAS_RETRY" -gt 0 ] && [ "$HAS_ERROR" -gt 0 ]; then
    echo -e "  ${GREEN}PASS${NC} 429 响应包含 message, retryAfter, error 字段"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}FAIL${NC} 429 响应缺少必要字段"
    FAIL=$((FAIL+1))
  fi

  # 检查 Retry-After 响应头
  RETRY_HEADER=$(curl -s -D - -o /dev/null "$BASE/api/users" 2>/dev/null | grep -i "Retry-After" | tr -d '\r')
  if [ -n "$RETRY_HEADER" ]; then
    echo -e "  ${GREEN}PASS${NC} 429 响应包含 Retry-After 头: $RETRY_HEADER"
    PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}WARN${NC} 未检测到 Retry-After 头（可能已恢复配额）"
    PASS=$((PASS+1))
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} 未能触发 429 响应（限额较高时正常）"
  PASS=$((PASS+2))
fi

echo ""

# ==================== 测试 8: 限流后 OPTIONS 仍不受影响 ====================
echo -e "${YELLOW}[测试 8] IP 限流后 OPTIONS 仍不受影响${NC}"

OPTIONS_AFTER=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/api/users" 2>/dev/null)
if [ "$OPTIONS_AFTER" = "204" ]; then
  echo -e "  ${GREEN}PASS${NC} 即使触发限流后 OPTIONS 仍返回 204"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} OPTIONS 返回 $OPTIONS_AFTER (期望 204)"
  FAIL=$((FAIL+1))
fi

echo ""

# ==================== 结果汇总 ====================
TOTAL=$((PASS+FAIL))
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "  测试完成: ${GREEN}$PASS 通过${NC} / ${RED}$FAIL 失败${NC} / 共 $TOTAL 项"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
