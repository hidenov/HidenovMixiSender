// HidenovMixiSenderAuth : https://github.com/hidenov/HidenovMixiSender
function debug_doGet()
{
  //const e = {"parameter":{"reset":"true"},"queryString":"reset=true","parameters":{"reset":["true"]},"contextPath":"","contentLength":-1} // reset
  const e = {"queryString":"","parameter":{},"contentLength":-1,"parameters":{},"contextPath":""} //execute
  doGet(e);
}

function doGet(e)
{
  const token_url = "https://secure.mixi-platform.com/2/token";
  const config = loadConfig();
  if(config.error === undefined)
  {
    if( Object.keys(e.parameter).length === 0 )
    {
      var post_data =
      {
        "grant_type": "server_state",
        "client_id": config.HidenovMixiSender.mixi.consumer_key
      };

      var options =
      {
        "method": "post",
        "payload": post_data
      };

      try
      {
        var json = JSON.parse(UrlFetchApp.fetch(token_url, options).getContentText());
        if (json.server_state)
        {
          var mixi_auth_link = "https://mixi.jp/connect_authorize.pl?client_id=" + post_data.client_id + "&response_type=code&scope=r_voice%20r_photo&display=pc&state=" + json.server_state;
          var html = "<p>下記のリンクに遷移して Mixi の認証を完了してください。</p><a>" + mixi_auth_link + "</a>";
          console.log(html);
          return HtmlService.createHtmlOutput(html);
        }
        else
        {
          console.log("Mixi からの応答の json の中に server_state が見つかりませんでしたにゃん");
          return ContentService.createTextOutput("Mixi からの応答の json の中に server_state が見つかりませんでしたにゃん");
        }
      }
      catch (ex)
      {
        console.log("API呼び出しエラーにゃん / 理由 = " + ex);
        return ContentService.createTextOutput("API呼び出しエラーにゃん / 理由 = " + ex);
      }
    }
    else
    {
      if(e.parameter.reset !== undefined)
      {
        reset(config);
        console.log("Mixi の認証情報をリセットしました。もう一度認証処理を実行してください。");
        return ContentService.createTextOutput("Mixi の認証情報をリセットしました。もう一度認証処理を実行してください。");
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
  config.HidenovMixiSender.mixi.bearer_token = "";
  config.HidenovMixiSender.mixi.refresh_token = "";
  config.HidenovMixiSender.mixi.access_token = "";
  saveConfig(config);
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