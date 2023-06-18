// HidenovTwitterAuth : https://github.com/hidenov/HidenovMixiSender
function debug_doGet()
{
  // const e = {"parameter":{"reset":"true"},"queryString":"reset=true","parameters":{"reset":["true"]},"contextPath":"","contentLength":-1} // reset
  const e = {"queryString":"","parameter":{},"contentLength":-1,"parameters":{},"contextPath":""} //execute
  doGet(e);
}

function doGet(e)
{
  let config = loadConfig();
  if(config.error === undefined)
  {
    if( Object.keys(e.parameter).length === 0 )
    {
      let html = "";
      const service_v2 = getServiceV2(config);
      if (service_v2.hasAccess())
      {
        console.log("V2 Already authorized");
        html = "<p>Twitter Oauth V2 は認証済みです。</p><br><br>"
      }
      else
      {
        const auth_url_v2 = service_v2.getAuthorizationUrl();
        console.log('V2 Auth URL = %s', auth_url_v2);
        html = "<p>下記のリンクに遷移して Twitter Oauth V2 の認証を完了してください。</p><a>" + auth_url_v2 + "</a><br><br>"
      }
      const service_v1 = getServiceV1(config);
      if (service_v1.hasAccess())
      {
        console.log("V1 Already authorized");
        html += "<p>Twitter Oauth V1 は認証済みです。</p><br><br>"
      }
      else
      {
        var auth_url_v1 = service_v1.authorize();
        console.log('V1 Auth URL = %s', auth_url_v1);
        html += "<p>下記のリンクに遷移して Twitter Oauth V1 の認証を完了してください。</p><a>" + auth_url_v1 + "</a>"
      }
      return HtmlService.createHtmlOutput(html);
    }
    else
    {
      if(e.parameter.reset !== undefined)
      {
        reset(config);
        console.log("Twitter の認証情報をリセットしました。もう一度認証処理を実行してください。");
        return ContentService.createTextOutput("Twitter の認証情報をリセットしました。もう一度認証処理を実行してください。");
      }
      else
      {
        console.log("不正なパラメータによる呼び出しにゃん / e = " + JSON.stringify(e));
        return ContentService.createTextOutput("不正なパラメータによる呼び出しにゃん / e = " + JSON.stringify(e));
      }
    }
  }
  else
  {
    console.log(config.error);
    return ContentService.createTextOutput(config.error);
  }
}

function reset(config)
{
  getServiceV1(config).reset();
  getServiceV2(config).reset();
  config.HidenovMixiSender.twitter.code_challenge = "";
  config.HidenovMixiSender.twitter.code_verifier = "";
  config.HidenovMixiSender.twitter.oauth_v1 = "";
  config.HidenovMixiSender.twitter.oauth_v2 = "";
  saveConfig(config);
}

function getServiceV1(config)
{
  return OAuth1.createService('twitter')
    .setAccessTokenUrl('https://api.twitter.com/oauth/access_token')
    .setRequestTokenUrl('https://api.twitter.com/oauth/request_token')
    .setAuthorizationUrl('https://api.twitter.com/oauth/authenticate')
    .setConsumerKey(config.HidenovMixiSender.twitter.consumer_key_v1)
    .setConsumerSecret(config.HidenovMixiSender.twitter.consumer_secret_v1)
    .setCallbackFunction('authCallbackV1')
    .setPropertyStore(PropertiesService.getScriptProperties());
}

function authCallbackV1(request) {
  let config = loadConfig()
  if( config.error === undefined )
  {
    var service = getServiceV1(config);
    var authorized = service.handleCallback(request);
    if (authorized)
    {
      const oauth_v1 = PropertiesService.getScriptProperties().getProperty("oauth1.twitter");
      if( oauth_v1 !== null )
      {
        config.HidenovMixiSender.twitter.oauth_v1 = oauth_v1 ;
        saveConfig(config) ;
        return HtmlService.createHtmlOutput("Twitter(V1) の認証情報を Google Drive に保存しました");
      }
      else
      {
        return HtmlService.createHtmlOutput("Twitter(V1) の認証情報がスクリプトプロパティの oauth1.twitter に設定されてないにゃん");
      }
    }
    else
    {
      return HtmlService.createHtmlOutput("Twitter(V1) の認証情報の Google Drive への保存に失敗しました");
    }
  }
  else
  {
    console.log(config.error);
    return ContentService.createTextOutput(config.error);
  }
}

function getServiceV2(config) {
  const codes = pkceChallengeVerifier(config);
  return OAuth2.createService('twitter')
    .setAuthorizationBaseUrl('https://twitter.com/i/oauth2/authorize')
    .setTokenUrl('https://api.twitter.com/2/oauth2/token?code_verifier=' + codes.code_verifier)
    .setClientId(config.HidenovMixiSender.twitter.client_id_v2)
    .setClientSecret(config.HidenovMixiSender.twitter.client_secret_v2)
    .setCallbackFunction('authCallbackV2')
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('users.read tweet.read tweet.write offline.access')
    .setParam('response_type', 'code')
    .setParam('code_challenge_method', 'S256')
    .setParam('code_challenge', codes.code_challenge)
    .setTokenHeaders({
      'Authorization': 'Basic ' + Utilities.base64Encode(config.HidenovMixiSender.twitter.client_id_v2 + ':' + config.HidenovMixiSender.twitter.client_secret_v2),
      'Content-Type': 'application/x-www-form-urlencoded'
    })
}

function authCallbackV2(request) {
  let config = loadConfig()
  if( config.error === undefined )
  {
    const service = getServiceV2(config);
    const authorized = service.handleCallback(request);
    if (authorized)
    {
      const oauth_v2 = PropertiesService.getScriptProperties().getProperty("oauth2.twitter");
      if( oauth_v2 !== null )
      {
        config.HidenovMixiSender.twitter.oauth_v2 = oauth_v2 ;
        saveConfig(config) ;
        return HtmlService.createHtmlOutput("Twitter(V2) の認証情報を Google Drive に保存しました");
      }
      else
      {
        return HtmlService.createHtmlOutput("Twitter(V2) の認証情報がスクリプトプロパティの oauth1.twitter に設定されてないにゃん");
      }
    }
    else
    {
      return HtmlService.createHtmlOutput("Twitter(V2) の認証情報の Google Drive への保存に失敗しました");
    }
  }
  else
  {
    console.log(config.error);
    return ContentService.createTextOutput(config.error);
  }
}

function pkceChallengeVerifier(config) {
  let code_challenge = config.HidenovMixiSender.twitter.code_challenge ;
  let code_verifier = config.HidenovMixiSender.twitter.code_verifier ;
  if (code_verifier.length === 0)
  {
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    for (var i = 0; i < 128; i++) {
      code_verifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    var sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code_verifier)
    code_challenge = Utilities.base64Encode(sha256Hash)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    config.HidenovMixiSender.twitter.code_verifier = code_verifier ;
    config.HidenovMixiSender.twitter.code_challenge = code_challenge ;
    saveConfig(config);
  }
  return { code_challenge : code_challenge, code_verifier : code_verifier };
}

function loadConfig()
{
  let error = {};
  const folder_id = PropertiesService.getScriptProperties().getProperty("folder_id");
  if( folder_id !== null )
  {
    const files = DriveApp.getFolderById(folder_id).getFilesByName("config.json");
    if(files.hasNext())
    {
      const file = files.next();
      if (file.getMimeType() === 'application/json')
      {
        const content = file.getBlob().getDataAsString();
        if(content !== null)
        {
          const json = JSON.parse(content);
          if( json !== null )
          {
            return json;
          }
          else
          {
            error = "config.json の内容が整形式の json じゃなかったにゃん。";
          }
        }
        else
        {
          error = "config.json が読み取れなかったにゃん。たぶん権限の問題があるにゃん。";
        }
      }
      else
      {
        error = "config.json が json 形式で保存されてないにゃん";
      }
    }
    else
    {
      error = "Folder ID = " + folder_id + " のフォルダ内に config.json ファイルが見つからないにゃん";
    }
  }
  else
  {
    error = "スクリプトプロパティに folder_id の設定が欠けてるにゃん";
  }
  return {error:error};
}

function saveConfig( config )
{
  const folder_id = PropertiesService.getScriptProperties().getProperty("folder_id");
  if( folder_id !== null )
  {
    const folder = DriveApp.getFolderById(folder_id) ;
    if( folder !== null )
    {
      const files = folder.getFilesByName("config.json");
      while (files.hasNext())
      {
        let file = files.next();
        if (file.getMimeType() === 'application/json')
        {
          folder.removeFile(file);
        }
      }
      folder.createFile("config.json", JSON.stringify(config, null, "    "));
    }
  }
}
