import * as StellarSdk from '@stellar/stellar-sdk'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// ── Soroban Contract Configuration ──────────────────────────────────────────
// Set SOROBAN_CONTRACT_ID in .env.local after running contracts/deploy.sh
// When unset, the system falls back to Classic Horizon manageData operations.
export const POULTRY_LEDGER_CONTRACT_ID = process.env.SOROBAN_CONTRACT_ID || null
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org'

export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const NETWORK = StellarSdk.Networks.TESTNET

/**
 * Resolve the session key path.
 * On Vercel (process.env.VERCEL is set) the project root is read-only —
 * use /tmp which is writable per-instance. Locally use scratch/ in project root.
 */
function getSessionKeyPath(): string {
  if (process.env.VERCEL) {
    return '/tmp/flockchain_session_key.json'
  }
  const scratchDir = path.join(process.cwd(), 'scratch')
  try {
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true })
  } catch { /* ignore */ }
  return path.join(scratchDir, 'session_key.json')
}

/**
 * Auto-initialize a stable server secret key.
 * Priority: STELLAR_SECRET_KEY env var → persisted session file → new random key.
 * On Vercel each cold-start may generate a new key if /tmp is cleared — this is
 * acceptable for Testnet demos; set STELLAR_SECRET_KEY in Vercel env for persistence.
 */
export function getOrCreateServerSecretKey(): string {
  if (process.env.STELLAR_SECRET_KEY) {
    return process.env.STELLAR_SECRET_KEY
  }

  const sessionKeyPath = getSessionKeyPath()

  try {
    if (fs.existsSync(sessionKeyPath)) {
      const data = JSON.parse(fs.readFileSync(sessionKeyPath, 'utf8'))
      if (data.secretKey) return data.secretKey
    }

    // Generate brand new stable Testnet keypair
    const kp = StellarSdk.Keypair.random()
    const secretKey = kp.secret()

    fs.writeFileSync(sessionKeyPath, JSON.stringify({
      secretKey,
      publicKey: kp.publicKey(),
      generatedAt: new Date().toISOString()
    }), 'utf8')

    console.log(`[Stellar] Generated session keypair: ${kp.publicKey()}`)

    // Fund issuer keypair via Friendbot asynchronously
    console.log(`[Stellar] Funding issuer account ${kp.publicKey()} via Friendbot...`)
    fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
      .then(res => {
        if (res.ok) console.log(`[Stellar] Issuer ${kp.publicKey()} funded successfully.`)
        else console.error(`[Stellar] Friendbot failed:`, res.statusText)
      })
      .catch(e => console.error(`[Stellar] Friendbot error:`, e))

    return secretKey
  } catch (e) {
    console.error('[Stellar] Failed to manage session key, using ephemeral key:', e)
    return StellarSdk.Keypair.random().secret()
  }
}

// Derive issuer public key from server private key
export function getIssuerPublicKey(): string {
  const secret = getOrCreateServerSecretKey()
  try {
    return StellarSdk.Keypair.fromSecret(secret).publicKey()
  } catch (e) {
    console.error('[Stellar] Invalid server secret key, using static fallback:', e)
    return 'GD35R7IYW6XZG5KTLXWTF27QJLTB7C7YMLWFR6F3K2VNZQND6TCOECOK'
  }
}

/**
 * Convert a 64-char hex string to a 32-byte Buffer.
 * Required for Stellar SDK's Memo.hash() and manageData value fields.
 */
function hexToBuffer32(hex: string): Buffer {
  return Buffer.from(hex, 'hex') // 64 hex chars → 32 bytes
}

export async function hashToStellar(sensorData: object) {
  const secret = getOrCreateServerSecretKey()
  const kp = StellarSdk.Keypair.fromSecret(secret)
  const dataHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...sensorData, recorded_at: new Date().toISOString() }))
    .digest('hex')

  const hashBuffer = hexToBuffer32(dataHash)

  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  let account
  try {
    account = await server.loadAccount(kp.publicKey())
  } catch {
    console.log(`[Stellar] Funding source account ${kp.publicKey()} via Friendbot...`)
    await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
    await new Promise(r => setTimeout(r, 2500))
    account = await server.loadAccount(kp.publicKey())
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK
  })
    .addMemo(StellarSdk.Memo.hash(hashBuffer))
    .addOperation(StellarSdk.Operation.manageData({
      name: 'sensor_hash',
      value: hashBuffer  // 32-byte Buffer — SDK encodes as base64 on-chain
    }))
    .setTimeout(45)
    .build()

  tx.sign(kp)
  const result = await server.submitTransaction(tx)
  const txHash = (result as { hash: string }).hash
  return {
    hash: dataHash,
    stellarTxHash: txHash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    timestamp: new Date().toISOString()
  }
}

export async function anchorCertificateToLedger(certId: string, certHash: string) {
  const secret = getOrCreateServerSecretKey()
  const kp = StellarSdk.Keypair.fromSecret(secret)
  const hashBuffer = hexToBuffer32(certHash)

  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  let account
  try {
    account = await server.loadAccount(kp.publicKey())
  } catch {
    console.log(`[Stellar] Funding cert issuer ${kp.publicKey()} via Friendbot...`)
    await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
    await new Promise(r => setTimeout(r, 2500))
    account = await server.loadAccount(kp.publicKey())
  }

  // manageData key: max 64 bytes — certId is safe but we slice as guard
  const dataKey = certId.slice(0, 64)

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK
  })
    .addMemo(StellarSdk.Memo.hash(hashBuffer))
    .addOperation(StellarSdk.Operation.manageData({
      name: dataKey,
      value: hashBuffer  // 32-byte Buffer
    }))
    .setTimeout(45)
    .build()

  tx.sign(kp)
  const result = await server.submitTransaction(tx)
  const txHash = (result as { hash: string }).hash
  return {
    stellarTxHash: txHash,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    timestamp: new Date().toISOString()
  }
}

export async function checkTrustlineAndBalance(publicKey: string, assetCode = 'ECO_KUKK') {
  const issuerPublicKey = getIssuerPublicKey()

  // Shortcircuit for simulation sandbox accounts
  if (publicKey.startsWith('GDEMO')) {
    return { hasTrustline: true, balance: '140.00', issuerPublicKey }
  }

  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  let account
  try {
    account = await server.loadAccount(publicKey)
  } catch (e: any) {
    if (e.response?.status === 404) {
      try {
        console.log(`[Stellar] Funding new account ${publicKey} via Friendbot...`)
        await fetch(`https://friendbot.stellar.org?addr=${publicKey}`)
        await new Promise(r => setTimeout(r, 2000))
        account = await server.loadAccount(publicKey)
      } catch (err) {
        console.error('[Stellar] Failed to fund account via Friendbot:', err)
      }
    }
  }

  if (!account) {
    return { hasTrustline: false, balance: '0.00', issuerPublicKey }
  }

  const trustline = (account.balances as any[]).find(
    b => b.asset_code === assetCode && b.asset_issuer === issuerPublicKey
  )

  return {
    hasTrustline: !!trustline,
    balance: trustline ? parseFloat(trustline.balance).toFixed(2) : '0.00',
    issuerPublicKey
  }
}

export async function createTrustlineTx(publicKey: string, assetCode = 'ECO_KUKK'): Promise<string> {
  const issuerPublicKey = getIssuerPublicKey()
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(publicKey)
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK
  })
    .addOperation(StellarSdk.Operation.changeTrust({
      asset: new StellarSdk.Asset(assetCode, issuerPublicKey),
      limit: '1000000'
    }))
    .setTimeout(60)
    .build()
  return tx.toXDR()
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  const transaction = new StellarSdk.Transaction(signedXdr, NETWORK)
  const result = await server.submitTransaction(transaction)
  return (result as { hash: string }).hash
}

export async function getTokenBalance(publicKey: string, assetCode = 'ECO_KUKK'): Promise<string> {
  try {
    const res = await checkTrustlineAndBalance(publicKey, assetCode)
    return res.balance
  } catch { return '0.00' }
}

// ── Soroban Contract Invocation Helpers ─────────────────────────────────────

/**
 * Invoke the PoultryLedger Soroban contract to record a sensor hash on-chain.
 * Falls back to Classic Horizon manageData if contract ID is not configured.
 */
export async function sorobanRecordSensorHash(
  farmId: string,
  hashHex: string,
): Promise<{ txHash: string; contractUsed: boolean }> {
  const secret = getOrCreateServerSecretKey()
  const kp = StellarSdk.Keypair.fromSecret(secret)
  const hashBuffer = hexToBuffer32(hashHex)

  if (!POULTRY_LEDGER_CONTRACT_ID) {
    // Fallback: Classic Horizon manageData
    const result = await hashToStellarWithBuffer(kp, hashBuffer)
    return { txHash: result, contractUsed: false }
  }

  // Soroban contract invocation via RPC
  try {
    const rpc = new StellarSdk.SorobanRpc.Server(SOROBAN_RPC_URL)
    const account = await rpc.getAccount(kp.publicKey())

    const farmIdScVal = StellarSdk.nativeToScVal(farmId, { type: 'symbol' })
    const hashScVal   = StellarSdk.xdr.ScVal.scvBytes(hashBuffer)
    const callerScVal = StellarSdk.nativeToScVal(kp.publicKey(), { type: 'address' })

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '1000000', // 0.1 XLM max fee for Soroban
      networkPassphrase: NETWORK,
    })
      .addOperation(
        StellarSdk.Operation.invokeContractFunction({
          contract:  POULTRY_LEDGER_CONTRACT_ID,
          function:  'record_sensor_hash',
          args:      [callerScVal, farmIdScVal, hashScVal],
        })
      )
      .setTimeout(60)
      .build()

    const prepared = await rpc.prepareTransaction(tx)
    prepared.sign(kp)
    const result = await rpc.sendTransaction(prepared)
    return { txHash: result.hash, contractUsed: true }
  } catch (e) {
    console.warn('[Stellar] Soroban invocation failed, falling back to manageData:', e)
    const result = await hashToStellarWithBuffer(kp, hashBuffer)
    return { txHash: result, contractUsed: false }
  }
}

/**
 * Invoke the PoultryLedger Soroban contract to issue a certificate on-chain.
 * Falls back to Classic Horizon manageData if contract ID is not configured.
 */
export async function sorobanIssueCertificate(
  certId: string,
  farmId: string,
  pfsiScore: number,
  certHashHex: string,
): Promise<{ txHash: string; contractUsed: boolean }> {
  const secret = getOrCreateServerSecretKey()
  const kp = StellarSdk.Keypair.fromSecret(secret)
  const hashBuffer = hexToBuffer32(certHashHex)

  if (!POULTRY_LEDGER_CONTRACT_ID) {
    const server = new StellarSdk.Horizon.Server(HORIZON_URL)
    let account
    try { account = await server.loadAccount(kp.publicKey()) }
    catch {
      await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
      await new Promise(r => setTimeout(r, 2500))
      account = await server.loadAccount(kp.publicKey())
    }
    const tx = new StellarSdk.TransactionBuilder(account, { fee: StellarSdk.BASE_FEE, networkPassphrase: NETWORK })
      .addMemo(StellarSdk.Memo.hash(hashBuffer))
      .addOperation(StellarSdk.Operation.manageData({ name: certId.slice(0, 64), value: hashBuffer }))
      .setTimeout(45).build()
    tx.sign(kp)
    const result = await server.submitTransaction(tx)
    return { txHash: (result as { hash: string }).hash, contractUsed: false }
  }

  // Soroban path
  try {
    const rpc = new StellarSdk.SorobanRpc.Server(SOROBAN_RPC_URL)
    const account = await rpc.getAccount(kp.publicKey())
    const pfsiX10 = Math.round(pfsiScore * 10) // e.g. 82.3 → 823

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: NETWORK,
    })
      .addOperation(
        StellarSdk.Operation.invokeContractFunction({
          contract:  POULTRY_LEDGER_CONTRACT_ID,
          function:  'issue_certificate',
          args: [
            StellarSdk.nativeToScVal(kp.publicKey(), { type: 'address' }),
            StellarSdk.nativeToScVal(farmId,  { type: 'symbol' }),
            StellarSdk.nativeToScVal(pfsiX10, { type: 'u32' }),
            StellarSdk.xdr.ScVal.scvBytes(hashBuffer),
            StellarSdk.nativeToScVal(certId,  { type: 'symbol' }),
          ],
        })
      )
      .setTimeout(60)
      .build()

    const prepared = await rpc.prepareTransaction(tx)
    prepared.sign(kp)
    const result = await rpc.sendTransaction(prepared)
    return { txHash: result.hash, contractUsed: true }
  } catch (e) {
    console.warn('[Stellar] Soroban cert invocation failed, falling back to manageData:', e)
    const result = await anchorCertificateToLedger(certId, certHashHex)
    return { txHash: result.stellarTxHash, contractUsed: false }
  }
}

/** Internal: submit a manageData transaction using a pre-built hash buffer */
async function hashToStellarWithBuffer(kp: StellarSdk.Keypair, hashBuffer: Buffer): Promise<string> {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  let account
  try { account = await server.loadAccount(kp.publicKey()) }
  catch {
    await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
    await new Promise(r => setTimeout(r, 2500))
    account = await server.loadAccount(kp.publicKey())
  }
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE, networkPassphrase: NETWORK
  })
    .addMemo(StellarSdk.Memo.hash(hashBuffer))
    .addOperation(StellarSdk.Operation.manageData({ name: 'sensor_hash', value: hashBuffer }))
    .setTimeout(45).build()
  tx.sign(kp)
  const result = await server.submitTransaction(tx)
  return (result as { hash: string }).hash
}
