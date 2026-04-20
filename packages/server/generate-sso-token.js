/**
 * SSO Token 生成脚本
 * 用于生成符合SSO方案的JWT Token
 */

import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import process from 'node:process'

// ========== 配置信息 ==========
const JWT_SECRET = 'Rz4eFYTp8CCGBGh6tpDoSPI/L8GUefjW3OfFcF4QOwI='
const AES_KEY = Buffer.from(
  '65bdd00e4d45dfea7d64a0e253f068ae8ad370f9130feca9a14e47a5e746c989',
  'hex'
)
const AES_IV = Buffer.from('22409c2b7417a8272694ccb7454db738', 'hex')

// ========== Mock 测试数据 ==========
const mockUsername = 'test'
const mockPassword = 'Srj@66666'

/**
 * AES-256-CBC 加密函数
 * @param {string} text - 要加密的明文
 * @param {Buffer} key - 加密密钥
 * @param {Buffer} iv - 初始化向量
 * @returns {string} Base64编码的加密结果
 */
function aesEncrypt(text, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return encrypted
}

/**
 * Base64URL 编码
 * @param {string} str - 要编码的字符串
 * @returns {string} Base64URL编码结果
 */
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * 生成JWT Token (HS256)
 * @param {object} payload - JWT payload数据
 * @param {string} secret - JWT签名密钥
 * @returns {string} JWT Token
 */
function generateJWT(payload, secret) {
  // JWT Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  // Base64URL 编码 header 和 payload
  const encodedHeader = base64urlEncode(JSON.stringify(header))
  const encodedPayload = base64urlEncode(JSON.stringify(payload))

  // 生成签名
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // 组合完整的JWT
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * 生成SSO Token
 * @param {string} username - 用户名
 * @param {string} password - 密码(明文)
 * @returns {object} 包含token和调试信息的对象
 */
function generateSSOToken(username, password) {
  // 1. AES加密密码
  const encryptedPassword = aesEncrypt(password, AES_KEY, AES_IV)

  // 2. 构建JWT payload
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    username,
    password: encryptedPassword,
    iat: now,
    exp: now + 600 // 10分钟后过期
  }

  // 3. 生成JWT Token
  const token = generateJWT(payload, JWT_SECRET)

  return {
    token,
    debugInfo: {
      username,
      originalPassword: password,
      encryptedPassword,
      issuedAt: new Date(now * 1000).toLocaleString('zh-CN'),
      expiresAt: new Date((now + 600) * 1000).toLocaleString('zh-CN')
    }
  }
}

const __filename = fileURLToPath(import.meta.url)
const runFile = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (runFile === __filename) {
  const [, , cliUsername, cliPassword] = process.argv
  const username = cliUsername || mockUsername
  const password = cliPassword || mockPassword
  const result = generateSSOToken(username, password)

  console.log('========== SSO Token 生成工具 ==========\n')
  console.log('📝 用户信息:')
  console.log(`   用户名: ${result.debugInfo.username}`)
  console.log(`   密码(明文): ${result.debugInfo.originalPassword}`)
  console.log(`   密码(加密): ${result.debugInfo.encryptedPassword}\n`)
  console.log('⏰ Token时间信息:')
  console.log(`   签发时间: ${result.debugInfo.issuedAt}`)
  console.log(`   过期时间: ${result.debugInfo.expiresAt}\n`)
  console.log('🔑 生成的JWT Token:')
  console.log(`${result.token}\n`)
  console.log('🌐 完整的SSO跳转URL示例:')
  console.log(`http://your-domain.com/authn/token-login?token=${result.token}\n`)
  console.log('========================================\n')
}

export { generateSSOToken, aesEncrypt }
