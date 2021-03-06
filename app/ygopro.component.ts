/**
 * Created by zh99998 on 16/9/2.
 */
import {Component, OnInit, ChangeDetectorRef, Input} from "@angular/core";
import {AppsService} from "./apps.service";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as child_process from "child_process";
import {remote} from "electron";
import * as ini from "ini";
import {EncodeOptions} from "ini";
import {LoginService} from "./login.service";
import {App} from "./app";
import {Http, Headers, URLSearchParams} from "@angular/http";
import "rxjs/Rx";
import {ISubscription} from "rxjs/Subscription";

declare var $;

interface SystemConf {
    use_d3d: string
    antialias: string
    errorlog: string
    nickname: string
    gamename: string
    lastdeck: string
    textfont: string
    numfont: string
    serverport: string
    lastip: string
    lastport: string
    autopos: string
    randompos: string
    autochain: string
    waitchain: string
    mute_opponent: string
    mute_spectators: string
    hide_setname: string
    hide_hint_button: string
    control_mode: string
    draw_field_spell: string
    separate_clear_button: string
    roompass: string
}

interface Server {
    id?: string
    url?: string
    address: string
    port: number
}

interface Room {
    id?: string
    title?: string
    server?: Server
    mode: number,
    rule: number,
    start_lp: number,
    start_hand: number,
    draw_count: number,
    enable_priority: boolean,
    no_check_deck: boolean,
    no_shuffle_deck: boolean
}

@Component({
    selector: 'ygopro',
    templateUrl: 'app/ygopro.component.html',
    styleUrls: ['app/ygopro.component.css'],
})
export class YGOProComponent implements OnInit {
    @Input()
    app: App;
    decks: string[] = [];
    current_deck: string;
    system_conf;
    numfont = {'darwin': ['/System/Library/Fonts/PingFang.ttc']};
    textfont = {'darwin': ['/System/Library/Fonts/PingFang.ttc']};

    windbot = ["琪露诺", "谜之剑士LV4", "复制植物", "尼亚"];

    servers: Server[] = [{
        id: 'tiramisu',
        url: 'wss://tiramisu.mycard.moe:7923',
        address: "112.124.105.11",
        port: 7911
    }];


    default_options: Room = {
        mode: 1,
        rule: 0,
        start_lp: 8000,
        start_hand: 5,
        draw_count: 1,
        enable_priority: false,
        no_check_deck: false,
        no_shuffle_deck: false
    };

    room: Room = Object.assign({title: this.loginService.user.username + '的房间'}, this.default_options);

    rooms: Room[] = [];

    connections: WebSocket[] = [];

    constructor(private http: Http, private appsService: AppsService, private loginService: LoginService, private ref: ChangeDetectorRef) {
    }

    ngOnInit() {
        this.system_conf = path.join(this.app.local.path, 'system.conf');
        this.refresh();

        let modal = $('#game-list-modal');

        modal.on('show.bs.modal', (event) => {
            this.connections = this.servers.map((server)=> {
                let connection = new WebSocket(server.url);
                connection.onclose = () => {
                    this.rooms = this.rooms.filter(room=>room.server != server)
                };
                connection.onmessage = (event) => {
                    let message = JSON.parse(event.data);
                    //console.log(message)
                    switch (message.event) {
                        case 'init':
                            this.rooms = this.rooms.filter(room => room.server != server).concat(message.data.map(data => Object.assign({server: server}, this.default_options, data)));
                            break;
                        case 'create':
                            this.rooms.push(Object.assign({server: server}, this.default_options, message.data));
                            break;
                        case 'update':
                            Object.assign(this.rooms.find(room=>room.server == server && room.id == message.data.id), this.default_options, message.data);
                            break;
                        case 'delete':
                            this.rooms.splice(this.rooms.findIndex(room=>room.server == server && room.id == message.data), 1);
                    }
                    this.ref.detectChanges()
                };
                return connection;
            });
        });

        modal.on('hide.bs.modal', (event) => {
            for (let connection of this.connections) {
                connection.close();
            }
            this.connections = []
        });
    }

    async refresh() {
        let decks = await this.get_decks();
        this.decks = decks;
        if (!(this.current_deck in this.decks)) {
            this.current_deck = decks[0];
        }
    };

    get_decks(): Promise<string[]> {
        return new Promise((resolve, reject)=> {
            fs.readdir(path.join(this.app.local.path, 'deck'), (error, files)=> {
                if (error) {
                    resolve([])
                } else {
                    resolve(files.filter(file=>path.extname(file) == ".ydk").map(file=>path.basename(file, '.ydk')));
                }
            })
        })
    }

    async get_font(files: string[]): Promise<string> {
        for (let file in files) {
            let found = await new Promise((resolve)=>fs.access(file, fs.constants.R_OK, error=>resolve(!error)));
            if (found) {
                return file;
            }
        }
    }

    async delete_deck(deck) {
        await new Promise(resolve => fs.unlink(path.join(this.app.local.path, 'deck', deck + '.ydk'), resolve));
        return this.refresh()
    }

    async fix_fonts(data) {
        if (!await this.get_font([data.numfont])) {
            let font = await this.get_font(this.numfont[process.platform]);
            if (font) {
                data['numfont'] = font
            }
        }

        if (!await this.get_font([data.textfont.split(' ', 2)[0]])) {
            let font = await this.get_font(this.textfont[process.platform]);
            if (font) {
                data['textfont'] = `${font} 14`
            }
        }
    };

    load_system_conf(): Promise<SystemConf> {
        return new Promise((resolve, reject)=> {
            fs.readFile(this.system_conf, {encoding: 'utf-8'}, (error, data) => {
                if (error) return reject(error);
                resolve(ini.parse(data));
            });
        })
    };

    save_system_conf(data: SystemConf) {
        return new Promise((resolve, reject)=> {
            fs.writeFile(this.system_conf, ini.stringify(data, <EncodeOptions>{whitespace: true}), (error) => {
                if (error) return reject(error);
                resolve(data);
            });
        })
    };

    async join(name, server) {
        let system_conf = await this.load_system_conf();
        await this.fix_fonts(system_conf);
        system_conf.lastdeck = this.current_deck;
        system_conf.lastip = server.address;
        system_conf.lastport = server.port;
        system_conf.roompass = name;
        system_conf.nickname = this.loginService.user.username;
        await this.save_system_conf(system_conf);
        return this.start_game(['-j']);
    };

    async edit_deck(deck: string) {
        let system_conf = await this.load_system_conf();
        await this.fix_fonts(system_conf);
        system_conf.lastdeck = deck;
        await this.save_system_conf(system_conf);
        return this.start_game(['-d']);
    }

    join_windbot(name) {
        return this.join('AI#' + name, this.servers[0])
    }

    start_game(args) {
        let win = remote.getCurrentWindow();
        win.minimize();
        return new Promise((resolve, reject)=> {
            let child = child_process.spawn(path.join(this.app.local.path, this.app.actions.get('main').execute), args, {cwd: this.app.local.path});
            child.on('error', (error)=> {
                reject(error);
                win.restore()
            });
            child.on('exit', (code, signal)=> {
                // error 触发之后还可能会触发exit，但是Promise只承认首次状态转移，因此这里无需重复判断是否已经error过。
                resolve();
                win.restore()
            })
        })
    };

    create_room(options) {
        let options_buffer = new Buffer(6);
        // 建主密码 https://docs.google.com/document/d/1rvrCGIONua2KeRaYNjKBLqyG9uybs9ZI-AmzZKNftOI/edit
        options_buffer.writeUInt8((options.private ? 2 : 1) << 4, 1);
        options_buffer.writeUInt8(parseInt(options.rule) << 5 | parseInt(options.mode) << 3 | (options.enable_priority ? 1 << 2 : 0) | (options.no_check_deck ? 1 << 1 : 0) | (options.no_shuffle_deck ? 1 : 0), 2);
        options_buffer.writeUInt16LE(parseInt(options.start_lp), 3);
        options_buffer.writeUInt8(parseInt(options.start_hand) << 4 | parseInt(options.draw_count), 5);
        let checksum = 0;
        for (let i = 1; i < options_buffer.length; i++) {
            checksum -= options_buffer.readUInt8(i)
        }
        options_buffer.writeUInt8(checksum & 0xFF, 0);

        let secret = this.loginService.user.external_id % 65535 + 1;
        for (let i = 0; i < options_buffer.length; i += 2) {
            options_buffer.writeUInt16LE(options_buffer.readUInt16LE(i) ^ secret, i)
        }

        let password = options_buffer.toString('base64') + options.title.replace(/\s/, String.fromCharCode(0xFEFF));
        let room_id = crypto.createHash('md5').update(password + this.loginService.user.username).digest('base64').slice(0, 10).replace('+', '-').replace('/', '_');

        this.join(password, this.servers[0]);
    }

    join_room(room) {
        let options_buffer = new Buffer(6);
        options_buffer.writeUInt8(3 << 4, 1);
        let checksum = 0;
        for (var i = 1; i < options_buffer.length; i++) {
            checksum -= options_buffer.readUInt8(i)
        }
        options_buffer.writeUInt8(checksum & 0xFF, 0);

        let secret = this.loginService.user.external_id % 65535 + 1;
        for (i = 0; i < options_buffer.length; i += 2) {
            options_buffer.writeUInt16LE(options_buffer.readUInt16LE(i) ^ secret, i)
        }


        let password = options_buffer.toString('base64') + room.id;

        this.join(password, room.server);
    }

    matching: ISubscription | null;
    matching_arena: string | null;

    request_match(arena = 'entertain') {
        let headers = new Headers();
        headers.append("Authorization", "Basic " + btoa(this.loginService.user.username + ":" + this.loginService.user.external_id));
        let search = new URLSearchParams();
        search.set("arena", arena);
        this.matching_arena = arena;
        this.matching = this.http.post('https://mycard.moe/ygopro/match', null, {
            headers: headers,
            search: search
        }).map(response=>response.json())
            .subscribe((data)=> {
                this.join(data['password'], {
                    address: data['address'],
                    port: data['port']
                });
            }, (error)=> {
                alert(`匹配失败\n${error}`)
            }, ()=> {
                this.matching = null;
                this.matching_arena = null;
            });
    }

    cancel_match() {
        this.matching.unsubscribe();
        this.matching = null;
        this.matching_arena = null;
    }
}
