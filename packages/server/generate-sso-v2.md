# SSO 单点登录对接方案 (下游接入指南)

## 整体流程

用户点击跳转 → 上游生成 Token → URL 跳转 → 下游验证 → 登录成功

## 一、跳转方式

上游平台将通过以下方式跳转到贵方系统：

```
${your-url}?token={JWT_TOKEN}
```

---

## 二、JWT Token 结构

### Payload (明文)

```json
{
  "username": "zhangsan", // 用户账号 (明文)
  "company": "info", // 公司标识 (明文)
  "exp": 1705234567, // 过期时间 (5-10 分钟)
  "iat": 1705234267 // 签发时间
}
```

---

## 三、加密方式

无额外加密，仅需 JWT 签名验证。

---

## 四、下游验证流程

```javascript
// 伪代码
function handleSSOLogin(token) {
  // 1. 验证 JWT 签名
  const decoded = jwt.verify(token, JWT_SECRET)

  // 2. 获取用户信息
  const username = decoded.username
  const company = decoded.company

  // 3. 调用贵方现有登录逻辑
  loginUser(username, company)

  // 4. 创建会话并跳转
  redirect('/dashboard')
}
```

---

## 五、对接信息

### JWT 签名密钥 (HS256)

```
Rz4eFYTp8CCGBGh6tpDoSPI/L8GUefjW3OfFcF4QOwI=
```

### 贵方需要提供给我方

- SSO 接收地址
- 测试账号（用于联调测试）
