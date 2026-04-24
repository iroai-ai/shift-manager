# シフト管理アプリ (Google Calendar連携)

Next.js 14 + Prisma + Supabase + Google Calendar API を使ったシフト管理Webアプリ。

---

## 起動手順

### 1. Node.js のインストール

https://nodejs.org から Node.js 18 以上をインストールしてください。

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を編集して各値を設定します（後述）。

### 4. DBマイグレーション

```bash
npm run db:generate   # Prisma Clientを生成
npm run db:push       # スキーマをDBに反映（開発用）
```

### 5. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 を開く。

---

## Google Cloud Console 設定手順

### A. プロジェクト作成

1. https://console.cloud.google.com にアクセス
2. 「プロジェクトを作成」→ 任意の名前で作成

### B. Google Calendar API を有効化

1. 「APIとサービス」→「ライブラリ」
2. "Google Calendar API" を検索して **有効にする**

### C. OAuth 同意画面の設定

1. 「APIとサービス」→「OAuth同意画面」
2. ユーザーの種類: **外部**
3. アプリ名・サポートメール・デベロッパーの連絡先を入力
4. スコープに以下を追加:
   - `https://www.googleapis.com/auth/calendar`
   - `openid`, `email`, `profile`
5. テストユーザーに自分のGmailを追加

### D. OAuth クライアントID の作成

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
2. アプリケーションの種類: **ウェブアプリケーション**
3. 承認済みのリダイレクトURIに追加:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   本番の場合は `https://yourdomain.com/api/auth/callback/google` も追加
4. クライアントID と クライアントシークレットをコピー

---

## Supabase 設定手順

1. https://supabase.com でプロジェクト作成
2. 「Settings」→「Database」→「Connection string」をコピー
3. `.env.local` の `DATABASE_URL` と `DIRECT_URL` に設定

### RLS (Row Level Security) の設定

Supabase SQL Editorで以下を実行:

```sql
-- shiftsテーブルのRLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all shifts"
  ON shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert shifts"
  ON shifts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update shifts"
  ON shifts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete shifts"
  ON shifts FOR DELETE TO authenticated USING (true);

-- usersテーブルのRLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT TO authenticated USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE TO authenticated USING (auth.uid()::text = id);
```

---

## 環境変数の説明

| 変数名 | 説明 |
|--------|------|
| `NEXTAUTH_URL` | アプリのURL（開発: `http://localhost:3000`） |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成 |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `DATABASE_URL` | Supabase PostgreSQL接続文字列 |
| `DIRECT_URL` | Supabase 直接接続文字列（Prisma用） |
| `RESEND_API_KEY` | Resend APIキー（メール通知、オプション） |
| `RESEND_FROM_EMAIL` | 送信元メールアドレス（オプション） |

---

## 動作確認チェックリスト

### 認証
- [ ] `/auth/signin` でGoogleログインボタンが表示される
- [ ] Googleでログイン後に `/dashboard` にリダイレクトされる
- [ ] ログアウトで `/auth/signin` に戻る
- [ ] リフレッシュトークンが `accounts` テーブルに保存されている

### シフト作成
- [ ] カレンダーの日付をクリックするとモーダルが開く
- [ ] スタッフ・日時・役割を入力して「保存」できる
- [ ] 保存後にカレンダーにイベントが表示される
- [ ] Google Calendar に同じイベントが登録されている
- [ ] DB の `shifts.sync_status` が `SYNCED` になっている

### シフト編集
- [ ] カレンダーのイベントをクリックすると編集モーダルが開く
- [ ] 内容を変更して保存すると Google Calendar も更新される
- [ ] ドラッグ&ドロップで日時変更できる
- [ ] イベントのリサイズで終了時刻を変更できる

### シフト削除
- [ ] 編集モーダルの「削除」ボタンでシフトを削除できる
- [ ] Google Calendar からもイベントが削除される

### エラーハンドリング
- [ ] Google API エラー時に `sync_status` が `FAILED` になる
- [ ] FAILED のイベントはカレンダーで赤枠で表示される
- [ ] トークン期限切れ後も自動リフレッシュされる

### 通知（Resend設定済みの場合）
- [ ] シフト作成時にスタッフへメールが届く
- [ ] 設定画面で通知のON/OFFを変更できる

---

## フォルダ構成

```
shift-manager/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth
│   │   ├── shifts/route.ts               # シフトCRUD
│   │   ├── shifts/[id]/route.ts          # シフト個別操作
│   │   ├── users/route.ts                # ユーザー一覧
│   │   ├── users/[id]/notifications/     # 通知設定
│   │   └── shift-patterns/route.ts       # パターンCRUD
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── page.tsx                  # カレンダー画面
│   │       └── settings/page.tsx         # 設定画面
│   ├── auth/signin/page.tsx              # ログイン画面
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   ├── ShiftCalendar.tsx                 # FullCalendarラッパー
│   ├── ShiftModal.tsx                    # シフト作成/編集モーダル
│   ├── NotificationSettings.tsx          # 通知設定UI
│   └── SignOutButton.tsx
├── lib/
│   ├── auth.ts                           # NextAuth設定 + トークン管理
│   ├── google-calendar.ts               # Google Calendar API
│   ├── notifications.ts                  # Resendメール通知
│   └── prisma.ts                         # Prismaクライアント
├── prisma/
│   └── schema.prisma                     # DBスキーマ
├── types/
│   └── next-auth.d.ts                    # Session型拡張
├── .env.example
└── package.json
```
