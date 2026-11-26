# A stand-in for the NS API with made-up trains, for testing and the README screenshots (key: testkey).
import http.server, json, datetime, urllib.parse
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        if self.headers.get('Ocp-Apim-Subscription-Key') != 'testkey':
            self.send_response(401); self.end_headers(); self.wfile.write(b'{}'); return
        u = urllib.parse.urlsplit(self.path); q = dict(urllib.parse.parse_qsl(u.query))
        tz = datetime.timezone(datetime.timedelta(hours=1)); now = datetime.datetime.now(tz).replace(second=0, microsecond=0)
        f = lambda d: d.strftime('%Y-%m-%dT%H:%M:%S%z')
        if u.path.endswith('/stations'):
            body = {'payload': [{'code': 'UT', 'land': 'NL', 'heeftVertrektijden': True, 'namen': {'lang': 'Utrecht Centraal'}}, {'code': 'ASD', 'land': 'NL', 'namen': {'lang': 'Amsterdam Centraal'}}, {'code': 'BRUSZ', 'land': 'B', 'namen': {'lang': 'Brussel-Zuid'}}]}
        else:
            deps = []
            data = [(2,'IC',3036,'Rotterdam Centraal','5','5',0,False),(5,'SPR',7436,'Den Haag Centraal','7','7',3,False),(9,'ICE',123,'Frankfurt (Main) Hbf','18','19',0,False),(12,'IC',2836,'Eindhoven Centraal','11','11',0,True),(16,'SPR',6036,'Zwolle','12','12',12,False),(20,'ICD',1124,'Breda','18','18',0,False)]
            for m,cat,no,d,pt,at,dl,cx in data:
                p = now + datetime.timedelta(minutes=m)
                deps.append({'direction': d, 'origin': d, 'plannedDateTime': f(p), 'actualDateTime': f(p + datetime.timedelta(minutes=dl)), 'plannedTrack': pt, 'actualTrack': at, 'product': {'number': str(no), 'shortCategoryName': cat, 'categoryCode': cat}, 'cancelled': cx, 'departureStatus': 'INCOMING'})
            body = {'payload': {'source': 'PPV', ('departures' if 'departures' in u.path else 'arrivals'): deps}}
        b = json.dumps(body).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(b)
http.server.HTTPServer(('127.0.0.1', 47900), H).serve_forever()
