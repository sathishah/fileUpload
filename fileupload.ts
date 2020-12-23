export class Options {
    url: string;
    method: string;
    data: Object;
    constructor(url: string, method?: string, data?: Object) {
        this.url = url;
        this.method = method || "get";
        this.data = data || {};
    }
}

export class Service {
    public request = (options: Options, successCallback: Function, errorCallback?: Function): void => {
        var self = this;
        $.ajax({
            url: options.url,
            type: options.method,
            data: options.data,
            cache: false,
            success: function (response) {
                successCallback(response);
            },
            error: function (response) {
                if (errorCallback) {
                    errorCallback(response);
                    return;
                }
                var errorTitle = "Error in (" + options.url + ")";
                var fullError = JSON.stringify(response);
                console.log(errorTitle);
                console.log(fullError);
                self.showJqueryDialog(fullError, errorTitle);
            }
        });
    }
    public get = (url: string, successCallback: Function, errorCallback?: Function): void => {
        this.request(new Options(url), successCallback, errorCallback);
    }
    public getWithDataInput = (url: string, data: Object, successCallback: Function, errorCallback?: Function): void => {
        this.request(new Options(url, "get", data), successCallback, errorCallback);
    }
    public post = (url: string, successCallback: Function, errorCallback?: Function): void => {
        this.request(new Options(url, "post"), successCallback, errorCallback);
    }
    public postWithData = (url: string, data: Object, successCallback: Function, errorCallback?: Function): void => {
        this.request(new Options(url, "post", data), successCallback, errorCallback);
    }

    public showJqueryDialog = (message: string, title?: string, height?: number): void => {
        alert(title + "\n" + message);
        title = title || "Info";
        height = height || 120;
        message = message.replace("\r", "").replace("\n", "<br/>");
        $("<div title='" + title + "'><p>" + message + "</p></div>").dialog({
            minHeight: height,
            minWidth: 400,
            maxHeight: 500,
            modal: true,
            buttons: {
                Ok: function () { $(this).dialog('close'); }
            }
        });
    }
}


import 'Service' as 'ajaxService' from 'Service';

export default class FileService {
    const file: File;
    const FILE_EXTENSIONS_ALLOWED: Array<string> = ['jpg', 'png', 'bpm', 'gif', 'tiff', 'tif', 'webp', 'raw', 'heif', 'indd', 'jpeg', 'jpeg2000', 'svg', 'ai', 'eps', 'psd', 'pdf'];
    constructor(file: any, uploadService: ajaxService) {
        this.file = file;
    }

    public uploadFile(fileObj: File, url: string, resultCallBack: Function): void {
        if (!!this.checkFileExtn(fileObj)) {
            this.upload(fileObj);
            this.uploadService.postWithData(url, fileObj, successCallback(resultData) {
                resultCallBack(resultData);
            });
        } else {
            resultCallBack("Invalid File Extension");
        }
    }

    public getFileExtension(fileName: string): string | null {
        const fileExtn = /^.+\.([^.]+)$/.exec(filename);
        return fileExtn == null ? "" : fileExtn[1];
    }

    public checkFileExtn(file: File): boolean {
        const fileExtn = this.getFileExtension(file.files[0].name.toLowerCase());
        return (this.FILE_EXTENSIONS_ALLOWED.indexOf(fileExtn) >= 0);
    }
}