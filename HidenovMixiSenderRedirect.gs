// HidenovMixiSenderRedirect : https://github.com/hidenov/HidenovMixiSender
function debug_doGet()
{
  var e =
  {
    parameter : { state:"state1234560000", code:"code9876543210000"}
  };
  //doGet(e);
  saveConfig(e) ;
}

function doGet(e)
{
  const token_url = "https://secure.mixi-platform.com/2/token";
  let config = loadConfig();
  if(config.HidenovMixiSender.mixi.consumer_key !== null && config.HidenovMixiSender.mixi.consumer_secret !== null )
  {
    const options = {
      "method": "post",
      "payload": {
        "grant_type": "authorization_code",
        "client_id": config.HidenovMixiSender.mixi.consumer_key,
        "client_secret": config.HidenovMixiSender.mixi.consumer_secret,
        "code":""
      }
    };

    try
    {
      const state = e.parameter.state;
      const code = e.parameter.code;

      if( state != undefined && code != undefined)
      {
        options.payload.code = code;
        const tokens = JSON.parse(UrlFetchApp.fetch(token_url, options).getContentText());
        if (tokens.refresh_token && tokens.access_token)
        {
          config.HidenovMixiSender.mixi.refresh_token = tokens.refresh_token ;
          config.HidenovMixiSender.mixi.access_token = tokens.access_token ;
          config.HidenovMixiSender.mixi.last_update = new Date().toISOString();
          console.log("Reflesh = " + tokens.refresh_token + " / Access = " + tokens.access_token);
          saveConfig(config) ;
        }
        else
        {
          return ContentService.createTextOutput("Mixi から token が取得できなかったにゃん");
        }
      }
      else
      {
        return ContentService.createTextOutput("呼び出しパラメータが不足してるにゃん");
      }
    }
    catch(error)
    {
      return ContentService.createTextOutput("Bad Request にゃん / 理由 = "+error);
    }
    return ContentService.createTextOutput("Mixi の認証情報を Google Drive に保存しました");
  }
  else
  {
    return ContentService.createTextOutput(config.error);
  }
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
