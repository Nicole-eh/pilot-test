#!/bin/bash

# 分页/排序/搜索功能测试脚本
# 用法: bash test-query.sh

BASE_URL="http://localhost:3000"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}   分页 / 排序 / 搜索 功能测试${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

# 检查服务器是否运行
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
  echo -e "${RED}服务器未运行！请先执行: npm run server${NC}"
  exit 1
fi
echo -e "${GREEN}服务器正在运行${NC}"
echo ""

# 先创建一些测试数据，确保有足够的用户
echo -e "${CYAN}[准备] 创建测试用户...${NC}"
curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"王五","email":"wangwu@example.com","age":35}' > /dev/null
curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"赵六","email":"zhaoliu@example.com","age":22}' > /dev/null
curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com","age":40}' > /dev/null
curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"张伟","email":"zhangwei@example.com","age":33}' > /dev/null
echo -e "${GREEN}测试用户已准备${NC}"
echo ""

# 创建一些 TODO 测试数据
echo -e "${CYAN}[准备] 创建测试 TODO...${NC}"
curl -s -X POST "$BASE_URL/api/todos" \
  -H "Content-Type: application/json" \
  -d '{"text":"学习 Node.js 基础"}' > /dev/null
curl -s -X POST "$BASE_URL/api/todos" \
  -H "Content-Type: application/json" \
  -d '{"text":"完成 REST API 开发"}' > /dev/null
curl -s -X POST "$BASE_URL/api/todos" \
  -H "Content-Type: application/json" \
  -d '{"text":"学习 JWT 认证"}' > /dev/null
curl -s -X POST "$BASE_URL/api/todos" \
  -H "Content-Type: application/json" \
  -d '{"text":"部署到服务器"}' > /dev/null
curl -s -X POST "$BASE_URL/api/todos" \
  -H "Content-Type: application/json" \
  -d '{"text":"编写测试用例"}' > /dev/null
echo -e "${GREEN}测试 TODO 已准备${NC}"
echo ""

# 断言函数
assert_json() {
  local desc="$1"
  local url="$2"
  local jq_expr="$3"
  local expected="$4"

  echo -e "${CYAN}[测试] $desc${NC}"
  echo "  GET $url"

  local response=$(curl -s "$BASE_URL$url")
  local actual=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
try:
    result = eval('data$jq_expr')
    print(result)
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null)

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} (期望: $expected, 实际: $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} (期望: $expected, 实际: $actual)"
    echo "  响应: $(echo "$response" | python3 -m json.tool 2>/dev/null | head -20)"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# 打印响应
show_response() {
  local desc="$1"
  local url="$2"
  echo -e "${CYAN}[展示] $desc${NC}"
  echo "  GET $url"
  curl -s "$BASE_URL$url" | python3 -m json.tool 2>/dev/null
  echo ""
}

echo -e "${BOLD}--- 用户 API 分页测试 ---${NC}"
echo ""

# 测试 1: 默认分页
assert_json "默认分页 (page=1, limit=10)" \
  "/api/users" \
  "['pagination']['currentPage']" \
  "1"

assert_json "默认分页 limit=10" \
  "/api/users" \
  "['pagination']['limit']" \
  "10"

# 测试 2: 自定义每页条数
assert_json "limit=2 只返回 2 条" \
  "/api/users?limit=2" \
  "['count']" \
  "2"

assert_json "limit=2 有下一页" \
  "/api/users?limit=2" \
  "['pagination']['hasNextPage']" \
  "True"

# 测试 3: 翻到第二页
assert_json "page=2&limit=2 是第 2 页" \
  "/api/users?page=2&limit=2" \
  "['pagination']['currentPage']" \
  "2"

assert_json "page=2&limit=2 有上一页" \
  "/api/users?page=2&limit=2" \
  "['pagination']['hasPrevPage']" \
  "True"

# 测试 4: 超大页码应回落到最后一页
assert_json "page=999 回落到最后一页" \
  "/api/users?page=999&limit=2" \
  "['pagination']['hasNextPage']" \
  "False"

echo -e "${BOLD}--- 用户 API 排序测试 ---${NC}"
echo ""

# 测试 5: 按年龄升序
assert_json "按 age 升序，第一个是最小年龄" \
  "/api/users?sort=age&order=asc&limit=100" \
  "['data'][0]['age'] <= ['data'][1]['age']" \
  "True"

# 测试 6: 按年龄降序
assert_json "按 age 降序，第一个是最大年龄" \
  "/api/users?sort=age&order=desc&limit=100" \
  "['data'][0]['age'] >= ['data'][1]['age']" \
  "True"

# 测试 7: 按名字排序
show_response "按 name 升序" \
  "/api/users?sort=name&order=asc&limit=100"

echo -e "${BOLD}--- 用户 API 搜索测试 ---${NC}"
echo ""

# 测试 8: 搜索 "张" 应匹配 张三、张伟
assert_json "搜索'张'至少匹配 2 条" \
  "/api/users?search=张&limit=100" \
  "['pagination']['totalItems'] >= 2" \
  "True"

# 测试 9: 搜索 email 关键字
assert_json "搜索 'bob' 匹配 email" \
  "/api/users?search=bob&limit=100" \
  "['pagination']['totalItems'] >= 1" \
  "True"

# 测试 10: 搜索不存在的关键字
assert_json "搜索不存在的关键字返回 0 条" \
  "/api/users?search=不存在的用户xyz&limit=100" \
  "['pagination']['totalItems']" \
  "0"

echo -e "${BOLD}--- 组合查询测试 ---${NC}"
echo ""

# 测试 11: 搜索 + 排序 + 分页
show_response "搜索'张' + 按 age 降序 + 每页1条" \
  "/api/users?search=张&sort=age&order=desc&limit=1"

echo -e "${BOLD}--- TODO API 分页/排序/搜索测试 ---${NC}"
echo ""

# 测试 12: TODO 分页
assert_json "TODO 默认分页" \
  "/api/todos" \
  "['pagination']['currentPage']" \
  "1"

# 测试 13: TODO 搜索
assert_json "TODO 搜索'学习'至少匹配 2 条" \
  "/api/todos?search=学习&limit=100" \
  "['pagination']['totalItems'] >= 2" \
  "True"

# 测试 14: TODO 分页 + limit
assert_json "TODO limit=2 只返回 2 条" \
  "/api/todos?limit=2" \
  "['count']" \
  "2"

# 测试 15: TODO 排序
show_response "TODO 按 createdAt 降序（最新在前）" \
  "/api/todos?sort=createdAt&order=desc&limit=3"

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "  测试结果: ${GREEN}$PASS 通过${NC} / ${RED}$FAIL 失败${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
else
  echo -e "${YELLOW}有 $FAIL 个测试未通过，请检查。${NC}"
fi
echo ""
