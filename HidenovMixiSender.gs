// HidenovMixiSender : https://github.com/hidenov/HidenovMixiSender
// Library : OAuth1 Version 18 = 1CXDCY5sqT9ph64fFwSzVtXnbjpSfWdRymafDrtIZ7Z_hwysTY7IIhi7s
// Library : OAuth2 Version 43 = 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF

function main()
{ 
  console.log("処理を開始しました");
  let config = loadConfig();
  if( checkConfig(config) === true )
  {
    const prev_tls = loadJSONFile("tls.json", {}) ;
    if( prev_tls.error === undefined )
    {
      try
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
            saveConfig(config); // for debug
            const service_v1 = getServiceV1(config);
            if (service_v1.hasAccess())
            {
              let tls = getTimelines(config, prev_tls);
              if( tls.tls !== undefined)
              {
                const updates = getUpdates(config, tls);
                console.log( JSON.stringify(updates, null, 4));
                if( updates.timelines.length > 0 )
                {
                  console.log("つぶやきが更新されました");
                  const photo = getPhoto(config);
                  if( postTwitter(config, updates, photo, tls) === true )
                  {
                    console.log("Twitter に投稿しました");
                  }
                  else
                  {
                    throw new Error("Twitter に投稿に失敗しました");
                  }
                }
                saveJSONFile("tls.json", tls) ;
              }
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
      catch(error)
      {
        throw error;
      }
      finally
      {
        saveConfig(config);
      }
    }
    else
    {
      throw new Error(prev_tls.error);
    }
  }
  else
  {
    throw new Error(config.error);
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

function getTimelines(config, prevTLs)
{
  const get_timeline_url = "https://api.mixi-platform.com/2/voice/statuses/@me/user_timeline";
  const get_comment_url = "https://api.mixi-platform.com/2/voice/replies/";
  const options = {
    "method": "GET",
    "headers": {
      "Authorization": "Bearer " + config.HidenovMixiSender.mixi.access_token
    },
    "parameters": {
      "attach_photo": "true",
      "trim_user":"true"
    }
  };
  let tls = {"tls":{}};

  try
  {
    const timeline = UrlFetchApp.fetch(get_timeline_url, options).getContentText();
/* for debug
    const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("folder_id")) ;
    const files = folder.getFilesByName("timeline.json");
    if (files.hasNext())
    {
      let file = files.next();
      file.setContent(timeline);
    }
    else
    {
      folder.createFile("timeline.json", timeline);
    }
*/
    const timeline_json = JSON.parse(timeline);
    if(Array.isArray(timeline_json)===true)
    {
      for (let i = 0; i < timeline_json.length; i++)
      {
        const item = timeline_json[i];
        tls.tls.user_id = item.user.id;
        tls.tls[item.id] = {};
        tls.tls[item.id].created_at = item.created_at ;
        tls.tls[item.id].text = getText(getPhotoIdFromText(item.text),item.text);
        tls.tls[item.id].twitter_id = getTwitterIDfromPrevTLs(item.user.id, null, prevTLs);
        tls.tls[item.id].comments = {} ;
        if(item.reply_count > 0)
        {
          const comments = UrlFetchApp.fetch(get_comment_url+item.id.toString(), options).getContentText();
          const comments_json = JSON.parse(comments);
          if(Array.isArray(comments_json) === true)
          {
            for (let j = 0; j < comments_json.length; j++)
            {
              const comment = comments_json[j];
              if( comment.user.id === tls.tls.user_id)
              {
                tls.tls[item.id].comments[comment.id] = {};
                tls.tls[item.id].comments[comment.id].created_at = comment.created_at ;
                tls.tls[item.id].comments[comment.id].text = comment.text
                tls.tls[item.id].comments[comment.id].twitter_id = getTwitterIDfromPrevTLs(item.id, comment.id, prevTLs);
              }
            }
          }
        }
      }
    }
    else
    {
      console.log("取得したつぶやきが配列になってないにゃん。たぶんつぶやきが存在しないか、応答の形式がおかしいにゃん");
    }
  }
  catch( error )
  {
    console.log("例外を握りつぶしています / Exception = " + error + "\n" + error.stack);
    tls = {};
  }
  return tls;
}

function getTwitterIDfromPrevTLs( itemID, commentID, prevTLs)
{
  // 前回の Timeline に紐づく Twitter の ID を返す。存在しなければ長さ 0 の文字列を返す。
  const twitter_id = prevTLs?.tls?.[itemID]?.twitter_id !== undefined
    ? prevTLs.tls[itemID].twitter_id
    : (prevTLs?.tls?.[itemID]?.comments?.[commentID]?.twitter_id || "");
  return twitter_id;
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

// urlString に含まれる photo の URL が含まれているときに、URL 部分を取り除き、文字列の長すぎる部分を切り詰める。
function getText(photoID, urlString)
{
  let temp_text = photoID === null ? urlString : urlString.substr(urlString.indexOf(' '));
  let adjusted_text = "", count = 0;

  for (let i = 0; i < temp_text.length && count < 280; i++)
  {
    let char = temp_text[i], code = char.charCodeAt(0);
    count += ((code >= 0x00 && code < 0x81) || code == 0xf8f0 || (code >= 0xff61 && code < 0xffa0) || (code >= 0xf8f1 && code < 0xf8f4)) ? 1 : 2;
    adjusted_text += char;
  }
  return adjusted_text;
}

function getUpdates(config, TLs)
{
  let updates = {latest_update:new Date(0), timelines:[]};
  const last_update = new Date(config.HidenovMixiSender.mixi.last_update);
  for (let mixi_id in TLs.tls)
  {
    if (TLs.tls.hasOwnProperty(mixi_id))
    {
      let tl = TLs.tls[mixi_id];
      const created_at = new Date(tl.created_at);
      if( updates.latest_update<created_at )
      {
        updates.latest_update = created_at;
        config.HidenovMixiSender.mixi.last_update = tl.created_at;
      }
      if(last_update<created_at)
      {
        let timeline = {};
        timeline.mixi_id = mixi_id;
        timeline.comment_id = "";
        timeline.created_at = created_at;
        timeline.photo_id = getPhotoIdFromText(tl.text);
        timeline.text = getText(timeline.photo_id,tl.text);
        updates.timelines.unshift(timeline) ;
      }
      for (let comment_id in TLs.tls[mixi_id].comments)
      {
        if (TLs.tls[mixi_id].comments.hasOwnProperty(comment_id))
        {
          let comment = TLs.tls[mixi_id].comments[comment_id];
          const comment_created_at = new Date(comment.created_at);
          if( updates.latest_update<comment_created_at )
          {
            updates.latest_update = comment_created_at;
            config.HidenovMixiSender.mixi.last_update = comment.created_at;
          }
          if(last_update<comment_created_at)
          {
            let timeline = {};
            timeline.mixi_id = mixi_id;
            timeline.comment_id = comment_id;
            timeline.created_at = created_at;
            timeline.photo_id = "";
            timeline.text = comment.text;
            updates.timelines.unshift(timeline) ;
          }        
        }
      }
    }
  }
  return updates 
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

function postTwitter(config, updates, photo, TLs)
{
  let rc = true ;
  const oauth_v2_json = JSON.parse(config.HidenovMixiSender.twitter.oauth_v2) ;
  for (let i in updates.timelines)
  {
    let media_id_string = null;
    console.log("つぶやき : 投稿 = " + updates.timelines[i].created_at + " / text = " + updates.timelines[i].text + ( updates.timelines[i].photo_id !== null ? " / photo_url = " + photo[updates.timelines[i].photo_id] : "")) ;
    if(updates.timelines[i].photo_id !== null) // Attach Image
    {
      if(photo[updates.timelines[i].photo_id] !== undefined)
      {
        media_id_string = uploadImage(config, photo[updates.timelines[i].photo_id])
      }
      else
      {
        console.log("無効な Photo ID にゃん。/ Photo ID = " + updates.timelines[i].photo_id) ;
      }
    }
    const twitter_id = postTweet(oauth_v2_json.access_token, updates.timelines[i].text, media_id_string) ;
    if(twitter_id.length > 0)
    {
      if(updates.timelines[i].comment_id.length > 0 )
      {
        TLs.tls[updates.timelines[i].mixi_id].comments[updates.timelines[i].comment_id].twitter_id = twitter_id;
      }
      else
      {
        TLs.tls[updates.timelines[i].mixi_id].twitter_id = twitter_id;
      }
    }
    else
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

function postTweet(accessTokenV2, timelineText, mediaIDString, tweetInfo )
{
  let twitter_id = "";
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
    if( result.hasOwnProperty("data") === true )
    {
      twitter_id = result.data.id;
    }
  }
  catch(error)
  {
    console.log( "Exception in PostTweet / Reason = " + error );
  }
  return twitter_id ;
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
      return { "error" : "config.json の内容が整形式の json じゃなかったにゃん。" };
    }
  }
  return loadJSONFile("config.json", null);
}

function loadJSONFile(fileName, defaultJSON)
{
  const folder_id = PropertiesService.getScriptProperties().getProperty("folder_id");
  if( folder_id !== null )
  {
    const files = DriveApp.getFolderById(folder_id).getFilesByName(fileName);
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
            return { "error" : fileName + " の内容が整形式の json じゃなかったにゃん" };
          }
        }
        else
        {
          return { "error" : fileName + " が読み取れなかったにゃん。たぶん権限の問題があるにゃん" };
        }
      }
      else
      {
        return { "error" : fileName + " が json 形式で保存されてないにゃん" };
      }
    }
    else
    {
      if( defaultJSON !== null )
      {
        return defaultJSON;
      }
      else
      {
        return { "error" : "Folder ID = " + folder_id + " のフォルダ内に " + fileName + " ファイルが見つからないにゃん" };
      }
    }
  }
  else
  {
    return { "error" : "スクリプトプロパティに folder_id の設定が欠けてるにゃん" };
  }
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
      if(retry === 0)
      {
        error = "Exception in saveConfig / Retry = " + retry.toString() + " / Reason = " + error_property;
        console.log( error ) ;
      }
      Utilities.sleep(3000);
    }
  }
  saveJSONFile("config.json", config)
}

function saveJSONFile(fileName, json)
{
  const folder_id = PropertiesService.getScriptProperties().getProperty("folder_id");
  if( folder_id !== null )
  {
    const folder = DriveApp.getFolderById(folder_id) ;
    if( folder !== null )
    {
      const files = folder.getFilesByName(fileName);
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
          folder.createFile(fileName, JSON.stringify(json, null, "    "));
          break;
        }
        catch( error_file )
        {
          if(retry === 0)
          {
            error = "Exception in saveConfig( " + fileName + " ) / Reason = " + error_file + "\n" + JSON.stringify(json, null, "    ") ;
            throw new Error( error ) ;
          }
          Utilities.sleep(3000);
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


function reset()
{
  PropertiesService.getScriptProperties().deleteProperty("config");
  PropertiesService.getScriptProperties().deleteProperty("oauth1.twitter");
  PropertiesService.getScriptProperties().deleteProperty("oauth2.twitter"); 
  console.log("スクリプトプロパティを削除しました。再度認証処理の実行が必要です");
}
