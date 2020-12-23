import { Component, OnInit } from '@angular/core';
import io from "socket.io-client";
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-upload-file-socket',
  templateUrl: './upload-file-socket.component.html',
  styleUrls: ['./upload-file-socket.component.css']
})
export class UploadFileSocketComponent implements OnInit {

  title = "resumeUpload-ui";
  selectedFile;
  fReader;
  name = "";
  uploadPercent;

  color = "primary";
  mode = "determinate";
  socket;
  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.socket= io("http://localhost:3000");
    
    this.socket.on("MoreData", data => {
      this.uploadPercent = data["percent"];
      let startingRange = data["startingRange"] * 5000000; //The Next Blocks Starting Position
      let newFile; //The Variable that will hold the new Block of data
      newFile = this.selectedFile.slice(
        startingRange,
        startingRange +
          Math.min(5000000, this.selectedFile.size - startingRange)
      );

      this.fReader.readAsBinaryString(newFile);
    });

    this.socket.on("Done", data => {
      this.uploadPercent = 100;
      console.log("File uploaded successfully");
    });
  }

  goToLink(url: string){
    window.open(url, "_blank");
  }

  onFileSelect(event) {
    this.selectedFile = event.target.files[0];
    this.name = this.selectedFile.name;
    console.log(this.selectedFile);
  }

  upload() {
    this.fReader = new FileReader();
    this.fReader.onload = evnt => {
      this.socket.emit("Upload", { fileName: this.name, data: evnt.target.result });
    };
    this.socket.emit("Start", { fileName: this.name, size: this.selectedFile.size });
  }
}



import { Pipe, PipeTransform } from '@angular/core';

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const FILE_SIZE_UNITS_LONG = ['Bytes', 'Kilobytes', 'Megabytes', 'Gigabytes', 'Pettabytes', 'Exabytes', 'Zettabytes', 'Yottabytes'];


@Pipe({
  name: 'fileSize'
})
export class FileSizePipe implements PipeTransform {

  transform(sizeInBytes: number, longForm: boolean): string {
    const units = longForm
      ? FILE_SIZE_UNITS_LONG
      : FILE_SIZE_UNITS;

    let power = Math.round(Math.log(sizeInBytes) / Math.log(1024));
    power = Math.min(power, units.length - 1);

    const size = sizeInBytes / Math.pow(1024, power); // size in new units
    const formattedSize = Math.round(size * 100) / 100; // keep up to 2 decimals
    const unit = units[power];

    return `${formattedSize} ${unit}`;
  }

}




import * as _ from 'lodash';

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, Output } from '@angular/core';

import { BehaviorSubject, Subscription } from 'rxjs';
import { HttpEventType } from '@angular/common/http';

export enum FileQueueStatus {
  Pending,
  Success,
  Error,
  Progress
}

export class FileQueueObject {
  public file: any;
  public status: FileQueueStatus = FileQueueStatus.Pending;
  public progress: number = 0;
  public request: Subscription = null;
  public response: HttpResponse<any> | HttpErrorResponse = null;

  constructor(file: any) {
    this.file = file;
  }

  // actions
  public upload = () => { /* set in service */ };
  public cancel = () => { /* set in service */ };
  public remove = () => { /* set in service */ };

  // statuses
  public isPending = () => this.status === FileQueueStatus.Pending;
  public isSuccess = () => this.status === FileQueueStatus.Success;
  public isError = () => this.status === FileQueueStatus.Error;
  public inProgress = () => this.status === FileQueueStatus.Progress;
  public isUploadable = () => this.status === FileQueueStatus.Pending || this.status === FileQueueStatus.Error;

}





// tslint:disable-next-line:max-classes-per-file
@Injectable()
export class FileUploaderService {

  public url: string = 'https://jsonplaceholder.typicode.com/posts';

  private _queue: BehaviorSubject<FileQueueObject[]>;
  private _files: FileQueueObject[] = [];

  constructor(private http: HttpClient) {
    this._queue = <BehaviorSubject<FileQueueObject[]>>new BehaviorSubject(this._files);
  }

  // the queue
  public get queue() {
    return this._queue.asObservable();
  }

  // public events
  public onCompleteItem(queueObj: FileQueueObject, response: any): any {
    return { queueObj, response };
  }

  // public functions
  public addToQueue(data: any) {
    // add file to the queue
    _.each(data, (file: any) => this._addToQueue(file));
  }

  public clearQueue() {
    // clear the queue
    this._files = [];
    this._queue.next(this._files);
  }

  public uploadAll() {
    // upload all except already successfull or in progress
    _.each(this._files, (queueObj: FileQueueObject) => {
      if (queueObj.isUploadable()) {
        this._upload(queueObj);
      }
    });
  }

  // private functions
  private _addToQueue(file: any) {
    const queueObj = new FileQueueObject(file);

    // set the individual object events
    queueObj.upload = () => this._upload(queueObj);
    queueObj.remove = () => this._removeFromQueue(queueObj);
    queueObj.cancel = () => this._cancel(queueObj);

    // push to the queue
    this._files.push(queueObj);
    this._queue.next(this._files);
  }

  private _removeFromQueue(queueObj: FileQueueObject) {
    _.remove(this._files, queueObj);
  }

  private _upload(queueObj: FileQueueObject) {
    // create form data for file
    const form = new FormData();
    form.append('file', queueObj.file, queueObj.file.name);

    // upload file and report progress
    const req = new HttpRequest('POST', this.url, form, {
      reportProgress: true,
    });

    // upload file and report progress
    queueObj.request = this.http.request(req).subscribe(
      (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          this._uploadProgress(queueObj, event);
        } else if (event instanceof HttpResponse) {
          this._uploadComplete(queueObj, event);
        }
      },
      (err: HttpErrorResponse) => {
        if (err.error instanceof Error) {
          // A client-side or network error occurred. Handle it accordingly.
          this._uploadFailed(queueObj, err);
        } else {
          // The backend returned an unsuccessful response code.
          this._uploadFailed(queueObj, err);
        }
      }
    );

    return queueObj;
  }

  private _cancel(queueObj: FileQueueObject) {
    // update the FileQueueObject as cancelled
    queueObj.request.unsubscribe();
    queueObj.progress = 0;
    queueObj.status = FileQueueStatus.Pending;
    this._queue.next(this._files);
  }

  private _uploadProgress(queueObj: FileQueueObject, event: any) {
    // update the FileQueueObject with the current progress
    const progress = Math.round(100 * event.loaded / event.total);
    queueObj.progress = progress;
    queueObj.status = FileQueueStatus.Progress;
    this._queue.next(this._files);
  }

  private _uploadComplete(queueObj: FileQueueObject, response: HttpResponse<any>) {
    // update the FileQueueObject as completed
    queueObj.progress = 100;
    queueObj.status = FileQueueStatus.Success;
    queueObj.response = response;
    this._queue.next(this._files);
    this.onCompleteItem(queueObj, response.body);
  }

  private _uploadFailed(queueObj: FileQueueObject, response: HttpErrorResponse) {
    // update the FileQueueObject as errored
    queueObj.progress = 0;
    queueObj.status = FileQueueStatus.Error;
    queueObj.response = response;
    this._queue.next(this._files);
  }

}



export class FileUploader implements FileQueueObject {
	constructor (private fqObj: FileQueueObject) {
		this.fqObj = getFileQueueDetails();
		return this.fqObj;
	}
	
	public getFileQueueDetails(): String | null {
		if (this.fqObj.status === "Pending") {
			console.log("Wait for the upload to finish");
		}
		
	}
}






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

export default class FileService implements FileQueueStatus {
	const file: File;
	const fileExtnAllowed: Array<string> = ['jpg', 'png', 'bpm', 'gif', 'tiff', 'tif', 'webp', 'raw', 'heif', 'indd', 'jpeg', 'jpeg2000', 'svg', 'ai', 'eps','psd', 'pdf'];
	constructor(file: any, uploadService: ajaxService) {
		this.file = file;
	}
	
	public uploadFile(fileObj: File, url: string, resultCallBack: Function): void {
		if (!!checkFileExtn(fileObj)) {
			this.upload(fileObj);			
			this.uploadService.postWithData(url, fileObj, successCallback(resultData) {
				resultCallBack(resultData);
			});
		} else {
			resultCallBack("Invalid File Extension");
		}
	}
	
	public getFileExtension(fileName: string): string | null{
		const fileExtn = /^.+\.([^.]+)$/.exec(filename);
		return fileExtn == null ? "" : fileExtn[1];
	}
	
	public checkFileExtn(file: File): string {		
		const fileExtn = this.getFileExtension(file.files[0].name);
		return  (this.fileExtnAllowed.indexOf(fileExtn) >= 0);
	}
}