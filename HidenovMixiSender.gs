// HidenovMixiSender : https://github.com/hidenov/HidenovMixiSender
// Library : OAuth1 Version 18 = 1CXDCY5sqT9ph64fFwSzVtXnbjpSfWdRymafDrtIZ7Z_hwysTY7IIhi7s
// Library : OAuth2 Version 43 = 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF

function main()
{ 
  try
  {
    console.log("処理を開始しました");
    let config = loadConfig();
    if( checkConfig(config) === true )
    {
      PropertiesService.getScriptProperties().setProperty("oauth1.twitter", config.HidenovMixiSender.twitter.oauth_v1);
      PropertiesService.getScriptProperties().setProperty("oauth2.twitter", config.HidenovMixiSender.twitter.oauth_v2);
      if( updateMixiToken(config) === true )
      {
        const service_v2 = getServiceV2(config);
        if (service_v2.hasAccess())
        {
          service_v2.refresh();
          config.HidenovMixiSender.twitter.oauth_v2 = PropertiesService.getScriptProperties().getProperty("oauth2.twitter");
          const service_v1 = getServiceV1(config);
          if (service_v1.hasAccess())
          {
            const update = getTimeline(config);
            if( update.timelines.length > 0 )
            {
              console.log("つぶやきが更新されました");
              const photo = getPhoto(config);
              const rc = PostTwitter(config, update, photo) ;
              if( rc === true )
              {
                console.log("Twitter に投稿しました");
              }
              else
              {
                throw new Error("Twitter に投稿に失敗しました");
              }
            }
            saveConfig(config);
          }
          else
          {
            throw new Error("Twitter V1 のアクセストークンが無効だにゃん。");
          }
        }
        else
        {
          throw new Error("Twitter V2 のアクセストークンが無効だにゃん。");
        }
      }
    }
    else
    {
      throw new Error(config.error);
    }
  }
  catch(error)
  {
    console.log("Exception / Reason = "+error);
    throw error;
  }
}

function updateMixiToken(config)
{
  const token_url = "https://secure.mixi-platform.com/2/token";
  const options = {
    "method": "post",
    "payload": {
      "grant_type": "refresh_token",
      "client_id": config.HidenovMixiSender.mixi.consumer_key,
      "client_secret": config.HidenovMixiSender.mixi.consumer_secret,
      "refresh_token": config.HidenovMixiSender.mixi.refresh_token
    }
  };

  const tokens = JSON.parse(UrlFetchApp.fetch(token_url, options).getContentText());
  if (tokens.refresh_token && tokens.access_token)
  {
    config.HidenovMixiSender.mixi.refresh_token = tokens.refresh_token ;
    config.HidenovMixiSender.mixi.access_token = tokens.access_token;
    saveConfig(config);
    return true ;
  }
  else
  {
    throw new Error("mixi から新しいトークンが取得できなかったにゃん。多分 reflesh_token が古いので、Auth からやり直すにゃん。");
  }
  return false;
}

function getServiceV1(config)
{
  return OAuth1.createService('twitter')
    .setAccessTokenUrl('https://api.twitter.com/oauth/access_token')
    .setRequestTokenUrl('https://api.twitter.com/oauth/request_token')
    .setAuthorizationUrl('https://api.twitter.com/oauth/authenticate')
    .setConsumerKey(config.HidenovMixiSender.twitter.consumer_key_v1)
    .setConsumerSecret(config.HidenovMixiSender.twitter.consumer_secret_v1)
    .setPropertyStore(PropertiesService.getScriptProperties());
}

function getServiceV2(config) {
  const codes = pkceChallengeVerifier(config);
  return OAuth2.createService('twitter')
    .setAuthorizationBaseUrl('https://twitter.com/i/oauth2/authorize')
    .setTokenUrl('https://api.twitter.com/2/oauth2/token?code_verifier=' + codes.code_verifier)
    .setClientId(config.HidenovMixiSender.twitter.client_id_v2)
    .setClientSecret(config.HidenovMixiSender.twitter.client_secret_v2)
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

function pkceChallengeVerifier(config)
{
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

function getTimeline(config)
{
    const get_timeline_url = "https://api.mixi-platform.com/2/voice/statuses/@me/user_timeline";
    const options = {
      'method': 'GET',
      'headers': {
        'Authorization': 'Bearer ' + config.HidenovMixiSender.mixi.access_token
      },
      'parameters': {
        "attach_photo": "true",
        "trim_user":"true"
      }
    };

    const json = UrlFetchApp.fetch(get_timeline_url, options).getContentText();
/* for debug
    const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("folder_id")) ;
    const files = folder.getFilesByName("timeline.json");
    if (files.hasNext())
    {
      let file = files.next();
      file.setContent(json);
    }
    else
    {
      folder.createFile("timeline.json", json);
    }
*/
    const timeline_json = JSON.parse(json);
    let update = {latest_update:new Date(0), timelines:[]};
    const last_update = new Date(config.HidenovMixiSender.mixi.last_update);
    if(Array.isArray(timeline_json))
    {
      for (let i = 0; i < timeline_json.length; i++)
      {
        const item = timeline_json[i];
        const created_at = new Date(item.created_at);
        if( update.latest_update<created_at )
        {
          update.latest_update = created_at;
          config.HidenovMixiSender.mixi.last_update = item.created_at;
        }
        if(last_update<created_at)
        {
          let timeline = {};
          timeline.created_at = created_at;
          timeline.photo_id = getPhotoIdFromText(item.text);
          timeline.text = timeline.photo_id===null ? item.text : getText(item.text);
          update.timelines.unshift(timeline) ;
        }
      }
    }
    else
    {
      console.log("取得したつぶやきが配列になってないにゃん。たぶんつぶやきが存在しないか、応答の形式がおかしいにゃん");
    }
    return update;
}

function getPhotoIdFromText(urlString)
{
  const target_prefix = 'http://photo.mixi.jp/view_photo.pl';
  const id_prefix = 'photo_id=';

  if (urlString.indexOf(target_prefix) === 0)
  {
    const start_index = urlString.indexOf(id_prefix);
    const end_index = urlString.indexOf(' ', urlString.indexOf(id_prefix));
    if (start_index !== -1 && end_index !== -1)
    {
      var id = urlString.substr(start_index + id_prefix.length, end_index - start_index - id_prefix.length);
      return id;
    }
  }
  return null;
}

// urlString に含まれる photo の URL が含まれているときに、URL 部分を取り除く。
function getText(urlString)
{
  const end_index = urlString.indexOf(' ');
  return urlString.substr(end_index);
}

function getPhoto(config)
{
    const get_photo_url = "https://api.mixi-platform.com/2/photo/mediaItems/@me/@self/@default";
    const options = {
      'method': 'GET',
      'headers': {
        'Authorization': 'Bearer ' + config.HidenovMixiSender.mixi.access_token
      },
      'parameters': {
        "count": "200",
        "startIndex":"0"
      }
    };

    json = UrlFetchApp.fetch(get_photo_url, options).getContentText();
    const photo_json = JSON.parse(json);
    let photo = {};
    for( let i = 0; i< photo_json.entry.length; i++)
    {
      let id = photo_json.entry[i].id;
      let url = photo_json.entry[i].url;
      photo[id] = url ;
    }
    return photo;
}

function PostTwitter(config, update, photo)
{
  let rc = true ;
  const oauth_v2_json = JSON.parse(config.HidenovMixiSender.twitter.oauth_v2) ;
  for (let i in update.timelines)
  {
    let media_id_string = null;
    console.log("つぶやき : 投稿 = " + update.timelines[i].created_at + " / text = " + update.timelines[i].text + ( update.timelines[i].photo_id !== null ? " / photo_url = " + photo[update.timelines[i].photo_id] : "")) ;
    if(update.timelines[i].photo_id !== null) // Attach Image
    {
      if(photo[update.timelines[i].photo_id] !== undefined)
      {
        media_id_string = uploadImage(config, photo[update.timelines[i].photo_id])
      }
      else
      {
        console.log("無効な Photo ID にゃん。/ Photo ID = " + update.timelines[i].photo_id) ;
      }
    }
    if( PostTweet(oauth_v2_json.access_token, update.timelines[i].text, media_id_string) === false )
    {
      rc = false ;
      break;
    }
  }
  return rc;
}

function uploadImage(config, imgUrl)
{
  try
  {
    const service_v1 = getServiceV1(config);
    if (service_v1.hasAccess())
    {
      const end_point_media = "https://upload.twitter.com/1.1/media/upload.json";
      const img_blob = UrlFetchApp.fetch(imgUrl).getBlob();
      const img_64  = Utilities.base64Encode(img_blob.getBytes());
      const options = { 'method':'POST', 'payload': { 'media_data' : img_64 }} ;
      const content = service_v1.fetch(end_point_media, options).getContentText();
      const image_upload = JSON.parse(content);
      console.log('media_id_string: %s',image_upload['media_id_string']);
      return image_upload['media_id_string'] ;
    }
    else
    {
      console.log("なぜか Twitter V1 のアクセストークンが無効だにゃん。") ;
    }
  }
  catch(error)
  {
    throw new Error ( "Exception in uploadImage / Reason = " + error );
  }
  return null;
}

function PostTweet(accessTokenV2, timelineText, mediaIDString )
{
  let rc = true;
  try
  {
    const url = `https://api.twitter.com/2/tweets`;
    let payload = {};
    if(mediaIDString === null)
    {
      payload = {
          text: timelineText
      };
    }
    else
    {
      payload = {
          text: timelineText,
          media : {media_ids: [mediaIDString]}
      };
    }
    const response = UrlFetchApp.fetch(url, {
          method: 'POST',
          'contentType': 'application/json',
          headers: {
            Authorization: 'Bearer ' + accessTokenV2
          },
          muteHttpExceptions: true,
          payload: JSON.stringify(payload)
        });
    const result = JSON.parse(response.getContentText());
    console.log(JSON.stringify(result, null, 4));
    if( result.hasOwnProperty("errors") == true )
    {
      rc = false ;
    }
  }
  catch(error)
  {
    console.log( "Exception in PostTweet / Reason = " + error );
    rc = false;
  }
  return rc ;
}

function loadConfig()
{
  let error = {};
  const property_config = PropertiesService.getScriptProperties().getProperty("config");
  if(property_config !== null)
  {
    const json = JSON.parse(property_config);
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
  }
  return {error:error};
}

function saveConfig( config )
{
  let error = "";
  for( let retry = 10; retry > 0; retry-- )
  {
    try
    {
      PropertiesService.getScriptProperties().setProperty("config", JSON.stringify(config));
      break;
    }
    catch( error_property )
    {
      error = "Exception in saveConfig( SaveProperty ) / Retry = " + retry.toString() + " / Reason = " + error_property;
      console.log( error ) ;
      Utilities.sleep(3000);
    }
    if( retry === 0 )
    {
      throw new Error( error ) ;
    }
  }

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
      for( let retry = 10; retry > 0; retry-- )
      {
        try
        {
          folder.createFile("config.json", JSON.stringify(config, null, "    "));
          break;
        }
        catch( error_file )
        {
          error = "Exception in saveConfig( SaveFile ) / Retry = " + retry.toString() + " / Reason = " + error_file ;
          console.log( error ) ;
          Utilities.sleep(3000);
        }
        if( retry === 0 )
        {
          throw new Error( error ) ;
        }
      }
    }
  }
}

function checkConfig( config )
{
  if( config.error === undefined )
  {
    if( config.HidenovMixiSender.mixi.consumer_key !== undefined && config.HidenovMixiSender.mixi.consumer_key.length > 0 &&
        config.HidenovMixiSender.mixi.consumer_secret !== undefined && config.HidenovMixiSender.mixi.consumer_secret.length > 0 &&
        config.HidenovMixiSender.mixi.refresh_token !== undefined && config.HidenovMixiSender.mixi.refresh_token.length > 0 &&
        config.HidenovMixiSender.mixi.access_token !== undefined && config.HidenovMixiSender.mixi.access_token.length > 0 &&
        config.HidenovMixiSender.twitter.code_challenge !== undefined && config.HidenovMixiSender.twitter.code_challenge.length > 0 &&
        config.HidenovMixiSender.twitter.code_verifier !== undefined && config.HidenovMixiSender.twitter.code_verifier.length > 0 &&
        config.HidenovMixiSender.twitter.oauth_v1 !== undefined && config.HidenovMixiSender.twitter.oauth_v1.length > 0 &&
        config.HidenovMixiSender.twitter.oauth_v2 !== undefined && config.HidenovMixiSender.twitter.oauth_v2.length > 0 )
    {
      if(config.HidenovMixiSender.mixi.last_update !== undefined && config.HidenovMixiSender.mixi.last_update.length > 0)
      {
        return true ;
      }
      else
      {
        console.log("最終更新日時が config.json 内に無いにゃん。もう一度認証処理をするか、last_update に自力で値を設定するにゃん。");
      }
    }
    else
    {
      console.log("全ての認証情報が config.json 内に揃って無いにゃん。もう一度認証処理をするにゃん。");
    }
  }
  else
  {
    console.log(config.error);
  }
  return false;
}
