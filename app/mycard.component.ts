import {Component, Renderer, ChangeDetectorRef, OnInit} from "@angular/core";
import {TranslateService} from "ng2-translate";
import {remote} from "electron";
import {LoginService} from "./login.service";


@Component({
    selector: 'mycard',
    templateUrl: 'app/mycard.component.html',
    styleUrls: ['app/mycard.component.css'],

})

export class MyCardComponent implements OnInit {
    currentPage: string = "lobby";

    platform = process.platform;
    currentWindow = remote.getCurrentWindow();
    window = window;

    ngOnInit() {

    }

    constructor(private renderer: Renderer, private translate: TranslateService, private loginService: LoginService, private ref: ChangeDetectorRef) {
        renderer.listenGlobal('window', 'message', (event) => {
            console.log(event);
            // Do something with 'event'
        });

        // this language will be used as a fallback when a translation isn't found in the current language
        translate.setDefaultLang('en-US');

        // the lang to use, if the lang isn't available, it will use the current loader to get them
        translate.use(remote.app.getLocale());

        this.currentWindow.on('maximize', ()=>ref.detectChanges());
        this.currentWindow.on('unmaximize', ()=>ref.detectChanges());
    }
}
