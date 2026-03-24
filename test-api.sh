#!/bin/bash

# API 测试脚本
# 使用方法: chmod +x test-api.sh && ./test-api.sh

echo "================================"
echo "🧪 Node.js API 测试脚本"
echo "================================"
echo ""

BASE_URL="http://localhost:3000"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
    echo -e "${BLUE}测试: $1${NC}"
    echo "请求: $2 $3"
    echo ""

    if [ "$2" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$3")
    elif [ "$2" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$3" \
            -H "Content-Type: application/json" \
            -d "$4")
    elif [ "$2" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$3" \
            -H "Content-Type: application/json" \
            -d "$4")
    elif [ "$2" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$3")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    echo "状态码: $http_code"
    echo "响应:"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    echo ""
    echo "================================"
    echo ""
}

# 检查服务器是否运行
echo "检查服务器状态..."
if ! curl -s "$BASE_URL" > /dev/null; then
    echo -e "${RED}❌ 服务器未运行！请先启动服务器: npm run server${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 服务器正在运行${NC}"
echo ""

# 测试 1: 获取所有用户
test_endpoint "1️⃣ 获取所有用户" "GET" "/api/users"

# 测试 2: 获取单个用户
test_endpoint "2️⃣ 获取单个用户 (ID=1)" "GET" "/api/users/1"

# 测试 3: 创建新用户
test_endpoint "3️⃣ 创建新用户" "POST" "/api/users" \
    '{"name":"测试用户","email":"test@example.com","age":25}'

# 测试 4: 更新用户
test_endpoint "4️⃣ 更新用户 (ID=1)" "PUT" "/api/users/1" \
    '{"name":"张三（已更新）","age":26}'

# 测试 5: 获取统计信息
test_endpoint "5️⃣ 获取统计信息" "GET" "/api/stats"

# 测试 6: 删除用户 (可选，注释掉以避免删除数据)
# test_endpoint "6️⃣ 删除用户 (ID=4)" "DELETE" "/api/users/4"

# 测试 7: 导出 CSV
echo -e "${BLUE}测试: 7️⃣ 导出 CSV${NC}"
echo "请求: GET /api/users/export/csv"
echo ""
curl -s "$BASE_URL/api/users/export/csv" -o users_test.csv
if [ -f users_test.csv ]; then
    echo -e "${GREEN}✅ CSV 文件已保存到 users_test.csv${NC}"
    echo "前 5 行内容："
    head -n 5 users_test.csv
else
    echo -e "${RED}❌ CSV 下载失败${NC}"
fi
echo ""
echo "================================"
echo ""

echo -e "${GREEN}✅ 所有测试完成！${NC}"
echo ""
echo "提示："
echo "- 查看完整 API 文档: 查看 中级功能说明.md"
echo "- 在浏览器中查看: $BASE_URL"
echo "- 清理测试文件: rm users_test.csv"
