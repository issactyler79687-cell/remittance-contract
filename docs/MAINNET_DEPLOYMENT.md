# Mainnet Deployment

Remit is deployed on Stellar Mainnet.

## Deployment

| Field | Value |
|---|---|
| Network | Stellar Mainnet |
| Source / deploy wallet | `GAHMY42DAKF4XBJMSVOK63LETPAUHAM2D6XQS764JBFL57N25FMYW42N` |
| Contract ID | `CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI` |
| WASM hash | `65c6aa5c986a146fab07009156b5578e9cc5a6d8df70c6a1d1060fd86bdf2697` |
| Native XLM SAC | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| Upload transaction | `61320fb0f9f1b095a3a9adc2199d386f8d04cc3e5c1576f6f44f05be69a2300e` |
| Deploy transaction | `bc9a5d63bfe8ca48d2ca69f8197b2c539475107a77c124377452b9400aeaa46d` |

## Contract Constructor

The deployed contract constructor records:

```text
deployer = GAHMY42DAKF4XBJMSVOK63LETPAUHAM2D6XQS764JBFL57N25FMYW42N
```

Native XLM is resolved inside the contract from the Mainnet network ID. No wallet address is used as `xlm_token`.

## Verification

Use Stellar Lab's Contract Explorer on Mainnet and enter:

```text
CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI
```

The repository does not store signed transaction XDR or private wallet material.

## Current Frontend Target

```text
Network: Mainnet
RPC: https://soroban-rpc.mainnet.stellar.gateway.fm
Contract ID: CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI
```
