# HidenovMixiSender
mixi のつぶやきに投稿した内容を　Twitter に転送する GAS( Google Apps Script ) アプリです。

- イーロン兄貴が Twitter API を無料ではまともに使えなくしたことに伴い、Twitter→mixi へつぶやきを転送するのはとてもカネがかかるようになりました。
- なので mixi が Twiiter のつぶやきを mixi に転送するサービスを止めてしまったことはしかたがないです．．．
- カネが無いのはイーロン兄貴も mixi もひでのふも皆同じ。よってこの仕組みは無料で実現できています。
- そうは言ってもハードルは結構高いです！覚悟は良いか！

## 使い方
### 準備するもの
- 有効なクレジットカード（ 2023.07.08 現在 mixi から課金は行われていない ）
- Docomo、AU、Softbank 何れかのキャリアが提供している MMS のメールアドレス
- Google Drive / GMail のアカウント
- mixi のアカウント
- Twitter のアカウント
### 大雑把な準備の手順
1. mixi Platform 利用登録を行う。
  下記の Partner Dashboard が表示できるようになればＯＫです。
  - [mixi Platform 利用登録方法](./mixi_registration.md)
![mixi Partner Dashboard](image.png)
2. Twitter の Developer Portal に登録を行う。
  - [Twitter 開発者プラットフォーム利用登録方法](./twitter_dev_registration.md)
　下記の Developer Portal が表示できるようになればＯＫです。
![Twitter Developer Portal](image-1.png)
3. GAS のプロジェクトが作れるようになる。
  下記の Apps Script のコンソールが表示できるようになればＯＫです。
![Alt text](image-2.png)
4. GitHub のこのリポジトリからソースコードをダウンロードする。
  下記の５つのファイルをダウンロードしてください。
   - <p>HidenovMixiSender.gs</p>
   - <p>HidenovMixiSenderAuth.gs</p>
   - <p>HidenovMixiSenderRedirect.gs</p>
   - <p>HidenovTwitterAuth.gs</p>
   - <p>config.json.org</p>
5. GDrive のマイドライブの下に、HidenovMixiSender のフォルダを作る。
6. 手順 5. で作成したフォルダのアドレスバーから、folder/ 以降の文字列を　folder_id としてメモする。
 ![Alt text](image-4.png)
7. <p>手順 5. で作成したフォルダに、手順 4.でダウンロードした config.json.org をアップロードする。</p>
8. 手順 5. で作成したフォルダで、Google Apps Script のプロジェクトを新しく作る。
  ![Alt text](image-3.png)
9.  <p>スクリプト名を HidenovMixiSender 変更し、手順 4.でダウンロードした HidenovMixiSender.gs の内容をコピペする。</p> 
10. スクリプトプロパティに folder_id を作成し、値に手順 6. でメモした folder_id を転記する。
11. プロジェクトを新しく Web アプリとしてデプロイする。デプロイした Web アプリの URL はメモしておく。
12.  手順 9. ～ 12. を他の３つの .gs ファイルに対しても同様に実行する。
13.  <p>mixi の Partner Dashboard から新規サービスを追加する。</p>
      - [mixi 新規サービス追加方法](./mixi_app_registration.md)
14.  <p>Twitter の Delevper Portal から新しいプロジェクトとアプリを作成する。
     - [Twitter アプリ追加方法](./twitter_app_registration.md)
     - App psermissions は　Read and Write を選ぶ
     - Type of App は Web App, Automated App or Bot を選ぶ
     - App info の Callback URI / Redirect URL は下記の要領で設定する。
  <p>https://script.google.com/macros/d/ ここにIDを入れる /usercallback</p>
  ID は HidenovTwitterAuth の projects/ から /edit までの間の文字列を入れる

  ![Alt text](image-7.png)

15.   <p>config.json.org にクレデンシャル情報を記載する。</p>
16.   <p>config.json.org をコピーし、config.json にリネームする。</p>
  
### 大雑把な使い方
1. デプロイした HidenovTwitterAuth の URL を開く。
2. 上手く行けば URL が二つ表示されるので、それぞれ別窓で開いて Twitter の承認処理を行う。
3. デプロイした HidenovMixiAuth の URL を開く。
4. 上手く行けば URL が表示されるので、別窓で開いて Mixi の承認処理を行う。
5. HidenovMixiSender のプロジェクトからトリガーを設定する。
     - 実行する関数は main
     - デプロイ時に実行は head
     - イベントのソースは 時間主導型
     - トリガーのタイプは 分ベースのタイマー
     - 無料版 GMail を使用している場合は時間間隔は５分以上に。１分にすると１日の GAS の実行制限を越えます。．

  
