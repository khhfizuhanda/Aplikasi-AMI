function randomSalt_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function hashPassword_(password,salt){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(salt)+'|'+String(password),Utilities.Charset.UTF_8);return bytes.map(b=>('0'+((b<0?b+256:b).toString(16))).slice(-2)).join('');}
function normalizeUsername_(v){return cleanText_(v).toLowerCase();}
function sanitizeUsername_(v){return normalizeUsername_(v).replace(/[^a-z0-9._-]+/g,'.').replace(/^\.+|\.+$/g,'').substring(0,40);}
function randomToken_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}


/* ============================================================
   V26 — HIGH CONCURRENCY SESSION LAYER
   - Login tidak lagi menunggu global ScriptLock.
   - Session baru menggunakan ScriptProperties sebagai persistent store
     dan ScriptCache sebagai fast path.
   - Sheet SESSIONS tetap dibaca sebagai fallback kompatibilitas untuk
     session deployment lama, sehingga upgrade tidak memutus user aktif.
   ============================================================ */
var V26_SESSION_PROP_PREFIX_='AMI_V26_SESSION_';
var V26_RESUME_PROP_PREFIX_='AMI_V26_RESUME_';
var V26_SESSION_CACHE_PREFIX_='AMI_V26_SC_';
var V26_RESUME_CACHE_PREFIX_='AMI_V26_RC_';
var V26_AUTHVER_PROP_PREFIX_='AMI_V26_AUTHVER_';
var V26_AUTHVER_CACHE_PREFIX_='AMI_V26_AV_';
var V26_LOGIN_RESULT_PREFIX_='AMI_V26_LOGIN_RESULT_';
var V26_LASTLOGIN_PROP_PREFIX_='AMI_V26_LASTLOGIN_';

/* V27 robustness layer: cleanup session properties, cached user snapshot,
   and short ResumeKey grace alias for concurrent/multi-tab reload. */
var V27_SESSION_CLEANUP_CACHE_KEY_='AMI_V27_SESSION_CLEANUP_GUARD';
var V27_USER_RECHECK_MS_=5*60*1000;
var V27_RESUME_ALIAS_SECONDS_=120;
function v27UserSnapshot_(u){
  u=u||{};return{UserID:cleanText_(u.UserID),Username:cleanText_(u.Username),Nama:cleanText_(u.Nama),Role:cleanText_(u.Role),RefType:cleanText_(u.RefType),RefID:cleanText_(u.RefID),Active:bool_(u.Active),ForceChangePassword:bool_(u.ForceChangePassword)};
}
function v27MaybeCleanupFastSessions_(){
  const cache=CacheService.getScriptCache();
  try{if(cache.get(V27_SESSION_CLEANUP_CACHE_KEY_))return{skipped:true};cache.put(V27_SESSION_CLEANUP_CACHE_KEY_,'1',900);}catch(ignore){}
  const props=PropertiesService.getScriptProperties(),all=props.getProperties(),now=Date.now(),active={};
  const del=[];let expired=0,orphanResume=0;
  Object.keys(all).forEach(function(k){
    if(k.indexOf(V26_SESSION_PROP_PREFIX_)!==0)return;
    const token=k.substring(V26_SESSION_PROP_PREFIX_.length),env=v26ParseSession_(all[k]);
    if(!env||!Number(env.expiresAt)||Number(env.expiresAt)<=now){del.push(k);expired++;try{cache.remove(V26_SESSION_CACHE_PREFIX_+token);}catch(ignore2){};return;}
    active[token]=true;
  });
  Object.keys(all).forEach(function(k){
    if(k.indexOf(V26_RESUME_PROP_PREFIX_)!==0)return;
    const token=cleanText_(all[k]);
    if(!token||!active[token]){del.push(k);orphanResume++;try{cache.remove(V26_RESUME_CACHE_PREFIX_+k.substring(V26_RESUME_PROP_PREFIX_.length));}catch(ignore3){}}
  });
  if(del.length){del.forEach(function(k){try{props.deleteProperty(k);}catch(ignore5){}});}
  return{skipped:false,expired:expired,orphanResume:orphanResume,deleted:del.length};
}

function v26SessionPropKey_(token){return V26_SESSION_PROP_PREFIX_+cleanText_(token);}
function v26ResumePropKey_(key){return V26_RESUME_PROP_PREFIX_+cleanText_(key);}
function v26AuthVersionKey_(userId){return V26_AUTHVER_PROP_PREFIX_+cleanText_(userId);}
function v26SessionTtlSeconds_(){
  const h=Number(AMI_CONFIG.SESSION_HOURS)||12;
  return Math.max(300,Math.min(86400,Math.round(h*3600)));
}
function v26CacheTtlSeconds_(){return Math.min(21600,v26SessionTtlSeconds_());}
function v26AuthVersion_(userId){
  userId=cleanText_(userId);if(!userId)return 1;
  const cache=CacheService.getScriptCache(),ck=V26_AUTHVER_CACHE_PREFIX_+userId;
  try{const cv=Number(cache.get(ck)||0);if(cv>0)return cv;}catch(ignore){}
  let n=1;
  try{n=Number(PropertiesService.getScriptProperties().getProperty(v26AuthVersionKey_(userId))||1)||1;}catch(ignore){}
  try{cache.put(ck,String(n),600);}catch(ignore){}
  return n;
}
function v26BumpAuthVersion_(userId){
  userId=cleanText_(userId);if(!userId)return 1;
  const props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache();
  const n=v26AuthVersion_(userId)+1;
  props.setProperty(v26AuthVersionKey_(userId),String(n));
  try{cache.put(V26_AUTHVER_CACHE_PREFIX_+userId,String(n),600);}catch(ignore){}
  return n;
}
function v26ParseSession_(raw){
  try{const e=JSON.parse(String(raw||''));return e&&e.token&&e.userId?e:null;}catch(ignore){return null;}
}
function v26SaveSession_(env){
  const raw=JSON.stringify(env),props=PropertiesService.getScriptProperties();
  const entries={};
  entries[v26SessionPropKey_(env.token)]=raw;
  entries[v26ResumePropKey_(env.resumeKey)]=env.token;
  props.setProperties(entries,false);
  const cache=CacheService.getScriptCache(),ttl=v26CacheTtlSeconds_();
  try{cache.put(V26_SESSION_CACHE_PREFIX_+env.token,raw,ttl);}catch(ignore){}
  try{cache.put(V26_RESUME_CACHE_PREFIX_+env.resumeKey,env.token,ttl);}catch(ignore){}
  return env;
}
function v26LoadSession_(token){
  token=cleanText_(token);if(!token)return null;
  const cache=CacheService.getScriptCache(),ck=V26_SESSION_CACHE_PREFIX_+token;
  let raw='';
  try{raw=cache.get(ck)||'';}catch(ignore){}
  if(!raw){try{raw=PropertiesService.getScriptProperties().getProperty(v26SessionPropKey_(token))||'';}catch(ignore){}}
  const env=v26ParseSession_(raw);if(!env)return null;
  const exp=Number(env.expiresAt||0);
  if(!exp||exp<=Date.now()){
    try{v26DeleteSession_(token,env.resumeKey);}catch(ignore){}
    return null;
  }
  if(Number(env.authVersion||1)!==v26AuthVersion_(env.userId)){
    try{v26DeleteSession_(token,env.resumeKey);}catch(ignore){}
    return null;
  }
  if(!raw || !String(raw).length)return null;
  try{cache.put(ck,JSON.stringify(env),v26CacheTtlSeconds_());}catch(ignore){}
  return env;
}
function v26ResumeToken_(resumeKey){
  resumeKey=cleanText_(resumeKey);if(!resumeKey)return '';
  const cache=CacheService.getScriptCache(),ck=V26_RESUME_CACHE_PREFIX_+resumeKey;
  let token='';
  try{token=cleanText_(cache.get(ck));}catch(ignore){}
  if(!token){try{token=cleanText_(PropertiesService.getScriptProperties().getProperty(v26ResumePropKey_(resumeKey)));}catch(ignore){}}
  if(token){try{cache.put(ck,token,v26CacheTtlSeconds_());}catch(ignore){}}
  return token;
}
function v26DeleteSession_(token,resumeKey){
  token=cleanText_(token);resumeKey=cleanText_(resumeKey);
  if(!token&&!resumeKey)return;
  const props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache();
  const keys=[];
  if(token)keys.push(v26SessionPropKey_(token));
  if(resumeKey)keys.push(v26ResumePropKey_(resumeKey));
  keys.forEach(function(k){try{props.deleteProperty(k);}catch(ignore){}});
  if(token)try{cache.remove(V26_SESSION_CACHE_PREFIX_+token);}catch(ignore){}
  if(resumeKey)try{cache.remove(V26_RESUME_CACHE_PREFIX_+resumeKey);}catch(ignore){}
}
function v26RotateResumeKey_(env){
  const oldKey=cleanText_(env.resumeKey),next=randomToken_();
  env.resumeKey=next;env.lastSeenAt=Date.now();env.expiresAt=Date.now()+v26SessionTtlSeconds_()*1000;
  const props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache();
  if(oldKey)try{props.deleteProperty(v26ResumePropKey_(oldKey));}catch(ignore){}
  v26SaveSession_(env);
  // V27: pertahankan alias ResumeKey lama hanya di cache selama 2 menit. Ini
  // mencegah dua tab yang reload bersamaan saling membatalkan kunci pemulihan.
  if(oldKey){try{cache.put(V26_RESUME_CACHE_PREFIX_+oldKey,env.token,V27_RESUME_ALIAS_SECONDS_);}catch(ignore2){}}
  return next;
}
function v26RefreshSessionAuthVersion_(token,newVersion){
  token=cleanText_(token);if(!token)return false;
  const cache=CacheService.getScriptCache();let raw='';
  try{raw=cache.get(V26_SESSION_CACHE_PREFIX_+token)||'';}catch(ignore){}
  if(!raw){try{raw=PropertiesService.getScriptProperties().getProperty(v26SessionPropKey_(token))||'';}catch(ignore){}}
  const env=v26ParseSession_(raw);if(!env)return false;
  env.authVersion=Number(newVersion)||1;
  env.lastSeenAt=Date.now();
  env.expiresAt=Date.now()+v26SessionTtlSeconds_()*1000;
  v26SaveSession_(env);return true;
}
function v26LoginRequestKey_(requestId){return V26_LOGIN_RESULT_PREFIX_+String(requestId||'').replace(/[^A-Za-z0-9_-]/g,'').substring(0,96);}
function v26GetLoginResult_(requestId){
  if(!requestId)return null;
  try{const raw=CacheService.getScriptCache().get(v26LoginRequestKey_(requestId));return raw?JSON.parse(raw):null;}catch(ignore){return null;}
}
function v26PutLoginResult_(requestId,result){
  if(!requestId)return;
  try{CacheService.getScriptCache().put(v26LoginRequestKey_(requestId),JSON.stringify(result),120);}catch(ignore){}
}
function v26RecordLastLogin_(userId){
  userId=cleanText_(userId);if(!userId)return;
  try{PropertiesService.getScriptProperties().setProperty(V26_LASTLOGIN_PROP_PREFIX_+userId,now_());}catch(ignore){}
}
function v26LastLogin_(userId,fallback){
  userId=cleanText_(userId);
  try{return PropertiesService.getScriptProperties().getProperty(V26_LASTLOGIN_PROP_PREFIX_+userId)||fallback||'';}catch(ignore){return fallback||'';}
}

function loginFailCacheKey_(username){return 'AMI_LOGIN_FAIL_'+normalizeUsername_(username);}
function clearLoginFailure_(username){try{CacheService.getScriptCache().remove(loginFailCacheKey_(username));}catch(ignore){}}
function clearAllKnownLoginFailures_(){try{getAllRows_('USERS').forEach(function(u){if(cleanText_(u.Username))clearLoginFailure_(u.Username);});clearLoginFailure_('admin');}catch(ignore){clearLoginFailure_('admin');}}

function ensureDefaultAdmin_(){
  const username=AMI_CONFIG.DEFAULT_ADMIN_USERNAME,password=AMI_CONFIG.DEFAULT_ADMIN_PASSWORD;
  const old=getAllRows_('USERS').find(r=>normalizeUsername_(r.Username)===normalizeUsername_(username));
  if(!old){const salt=randomSalt_();appendObject_('USERS',{UserID:uuid_('USR'),Username:username,PasswordHash:hashPassword_(password,salt),Salt:salt,Nama:'Administrator BPM',Role:'ADMIN_BPM',RefType:'',RefID:'',Active:true,ForceChangePassword:true,LastLogin:'',CreatedAt:now_(),UpdatedAt:now_()});clearLoginFailure_(username);return{created:true,repaired:false};}
  if(!cleanText_(old.Salt)||!cleanText_(old.PasswordHash)){const salt=randomSalt_();updateRow_('USERS',old._row,{Username:username,PasswordHash:hashPassword_(password,salt),Salt:salt,Nama:cleanText_(old.Nama)||'Administrator BPM',Role:'ADMIN_BPM',Active:true,ForceChangePassword:true,UpdatedAt:now_()});clearLoginFailure_(username);return{created:false,repaired:true};}
  if(cleanText_(old.Role)!=='ADMIN_BPM'||!bool_(old.Active))updateRow_('USERS',old._row,{Role:'ADMIN_BPM',Active:true,UpdatedAt:now_()});
  clearLoginFailure_(username);return{created:false,repaired:false};
}

function maintenanceResetAdmin_(){return withLock_(function(){const username='admin',password='admin123';const old=getAllRows_('USERS').find(r=>normalizeUsername_(r.Username)===username);const salt=randomSalt_();const rec={Username:username,PasswordHash:hashPassword_(password,salt),Salt:salt,Nama:'Administrator BPM',Role:'ADMIN_BPM',RefType:'',RefID:'',Active:true,ForceChangePassword:true,LastLogin:'',UpdatedAt:now_()};if(old){updateRow_('USERS',old._row,rec);v26BumpAuthVersion_(old.UserID);}else appendObject_('USERS',Object.assign({UserID:uuid_('USR'),CreatedAt:now_()},rec));deleteRowsByPredicate_('SESSIONS',()=>true);clearLoginFailure_(username);return{ok:true,username:'admin',password:'admin123',message:'Admin berhasil direset dan blokir percobaan login dibersihkan.'};});}

function cleanupExpiredSessions_(){
  // Legacy compatibility only. V26 session tidak lagi melakukan housekeeping
  // seluruh sheet pada setiap login.
  const now=Date.now();
  return deleteRowsByPredicate_('SESSIONS',r=>{if(!r.ExpiresAt)return true;const d=r.ExpiresAt instanceof Date?r.ExpiresAt:new Date(r.ExpiresAt);return isNaN(d.getTime())||d.getTime()<=now;});
}

function withLoginLock_(fn){
  // Compatibility wrapper. Jalur login V26 tidak memakai global ScriptLock.
  // Fungsi ini dipertahankan bila patch lama masih memanggilnya.
  return fn();
}

function login(username,password,requestId){
  username=normalizeUsername_(username);
  password=String(password==null?'':password);
  requestId=cleanText_(requestId);

  if(!username||!password){throw new Error('Username dan password wajib diisi.');}

  // Retry dari browser memakai requestId yang sama. Jika respons pertama sempat
  // terlambat tetapi sudah berhasil dibuat, retry menerima session yang sama.
  const prior=v26GetLoginResult_(requestId);
  if(prior&&prior.ok&&prior.token&&prior.user)return prior;

  let cache=null,key='',fail=0;
  try{cache=CacheService.getScriptCache();key=loginFailCacheKey_(username);fail=Number(cache.get(key)||0);}catch(ignoreCache){cache=null;key='';fail=0;}

  const u=getAllRows_('USERS').find(function(r){return normalizeUsername_(r.Username)===username;});
  if(u&&!bool_(u.Active))throw new Error('Akun ditemukan tetapi sedang nonaktif. Hubungi Administrator BPM atau sinkronkan kembali akun dari Master.');
  if(u&&(!cleanText_(u.Salt)||!cleanText_(u.PasswordHash)))throw new Error('Akun ditemukan tetapi credential login belum lengkap. Admin BPM perlu menjalankan Sinkronkan dari Master atau Reset Password.');

  const passwordMatches=!!u&&!!cleanText_(u.Salt)&&!!cleanText_(u.PasswordHash)&&hashPassword_(password,cleanText_(u.Salt))===cleanText_(u.PasswordHash);
  if(!passwordMatches){
    const nextFail=fail+1;try{if(cache&&key)cache.put(key,String(nextFail),600);}catch(ignore){}
    if(nextFail>=8)throw new Error('Terlalu banyak percobaan login yang salah. Masukkan password yang benar; sistem akan membersihkan blokir otomatis. Jika masih gagal, minta Admin BPM memeriksa akun atau melakukan Reset Password.');
    throw new Error('Username atau password salah.');
  }

  try{if(cache&&key)cache.remove(key);}catch(ignore){}
  try{clearLoginFailure_(username);}catch(ignore){}

  const token=randomToken_(),resumeKey=randomToken_(),ttl=v26SessionTtlSeconds_();
  const env={
    token:token,
    userId:cleanText_(u.UserID),
    resumeKey:resumeKey,
    authVersion:v26AuthVersion_(u.UserID),
    userSnapshot:v27UserSnapshot_(u),
    userCheckedAt:Date.now(),
    createdAt:Date.now(),
    lastSeenAt:Date.now(),
    expiresAt:Date.now()+ttl*1000
  };

  // Tidak ada Spreadsheet write dan tidak ada ScriptLock pada critical path login.
  v26SaveSession_(env);
  // Housekeeping ditrottle maksimal sekali per 15 menit, bukan setiap login.
  try{v27MaybeCleanupFastSessions_();}catch(ignoreCleanup){}

  // LastLogin V26 disimpan sebagai metadata ringan di ScriptProperties agar
  // autentikasi massal tidak menghasilkan puluhan write ke Google Sheet USERS.
  v26RecordLastLogin_(u.UserID);

  const result={ok:true,token:token,resumeKey:resumeKey,user:publicUser_(u),sessionStore:'V26_FAST'};
  v26PutLoginResult_(requestId,result);
  return result;
}

function logout(token){
  token=cleanText_(token);
  const env=v26LoadSession_(token);
  if(env){v26DeleteSession_(token,env.resumeKey);return{ok:true};}
  // Session lama tetap dapat logout normal.
  return withLock_(function(){deleteRowsByPredicate_('SESSIONS',r=>cleanText_(r.Token)===token);return{ok:true};});
}

function session_(token){
  token=cleanText_(token);if(!token)throw new Error('Sesi tidak tersedia. Silakan login kembali.');

  // Fast path V27: Cache -> ScriptProperties. User snapshot menghindari pembacaan
  // USERS pada setiap RPC; validasi ke sheet dilakukan berkala maksimal 5 menit.
  const env=v26LoadSession_(token);
  if(env){
    let u=env.userSnapshot||null;
    const mustRecheck=!u||!Number(env.userCheckedAt)||Date.now()-Number(env.userCheckedAt)>V27_USER_RECHECK_MS_;
    if(mustRecheck){
      u=findOne_('USERS','UserID',env.userId);
      if(!u||!bool_(u.Active)){v26DeleteSession_(token,env.resumeKey);throw new Error('Akun tidak aktif. Hubungi Administrator BPM.');}
      env.userSnapshot=v27UserSnapshot_(u);env.userCheckedAt=Date.now();v26SaveSession_(env);
    }else{
      u=Object.assign({},u);
      if(!bool_(u.Active)){v26DeleteSession_(token,env.resumeKey);throw new Error('Akun tidak aktif. Hubungi Administrator BPM.');}
    }
    try{
      const mins=(Date.now()-Number(env.lastSeenAt||0))/60000;
      const slide=Number(AMI_CONFIG.SESSION_SLIDING_MINUTES)||30;
      if(!isFinite(mins)||mins>=slide){env.lastSeenAt=Date.now();env.expiresAt=Date.now()+v26SessionTtlSeconds_()*1000;v26SaveSession_(env);}
    }catch(ignore){}
    return u;
  }

  // Legacy fallback supaya deployment V26 tidak langsung memutus sesi lama.
  const s=getAllRows_('SESSIONS').find(r=>cleanText_(r.Token)===token);if(!s)throw new Error('Sesi berakhir. Silakan login kembali.');
  const exp=s.ExpiresAt instanceof Date?s.ExpiresAt:new Date(s.ExpiresAt);if(isNaN(exp.getTime())||exp.getTime()<=Date.now()){try{deleteRowsByPredicate_('SESSIONS',r=>cleanText_(r.Token)===token);}catch(ignore){}throw new Error('Sesi berakhir. Silakan login kembali.');}
  const u=findOne_('USERS','UserID',s.UserID);if(!u||!bool_(u.Active))throw new Error('Akun tidak aktif. Hubungi Administrator BPM.');
  try{const last=s.LastSeenAt instanceof Date?s.LastSeenAt:new Date(s.LastSeenAt||0),mins=(Date.now()-last.getTime())/60000;if(isNaN(mins)||mins>=AMI_CONFIG.SESSION_SLIDING_MINUTES)updateRow_('SESSIONS',s._row,{LastSeenAt:new Date(),ExpiresAt:new Date(Date.now()+AMI_CONFIG.SESSION_HOURS*3600000)});}catch(ignore){}
  return u;
}
function requireRole_(token,roles){const u=session_(token);if(roles&&roles.indexOf(cleanText_(u.Role))<0)throw new Error('Anda tidak memiliki akses untuk tindakan ini.');return u;}
function publicUser_(u){return{userId:cleanText_(u.UserID),username:cleanText_(u.Username),nama:cleanText_(u.Nama),role:cleanText_(u.Role),refType:cleanText_(u.RefType),refId:cleanText_(u.RefID),forceChangePassword:bool_(u.ForceChangePassword)};}

/** Persistensi sesi untuk reload HtmlService. ResumeKey bukan token sesi. */
function createResumeKey(token){
  token=cleanText_(token);
  const env=v26LoadSession_(token);
  if(env)return serializeValue_({ok:true,resumeKey:env.resumeKey,user:publicUser_(session_(token))});
  return withLock_(function(){
    const u=session_(token);ensureSheetReady_('SESSIONS',SHEET_DEFS.SESSIONS);
    const row=getAllRows_('SESSIONS').find(function(r){return cleanText_(r.Token)===token;});
    if(!row)throw new Error('Sesi login tidak ditemukan. Silakan login kembali.');
    let key=cleanText_(row.ResumeKey);if(!key){key=randomToken_();updateRow_('SESSIONS',row._row,{ResumeKey:key,LastSeenAt:new Date(),ExpiresAt:new Date(Date.now()+(Number(AMI_CONFIG.SESSION_HOURS)||12)*3600000)});}
    return serializeValue_({ok:true,resumeKey:key,user:publicUser_(u)});
  });
}
function resumeSession(resumeKey){
  resumeKey=cleanText_(resumeKey);if(!resumeKey)throw new Error('Kunci pemulihan sesi tidak tersedia.');
  const token=v26ResumeToken_(resumeKey);
  if(token){
    const env=v26LoadSession_(token);if(!env)throw new Error('Sesi tersimpan tidak ditemukan. Silakan login kembali.');
    const currentKey=cleanText_(env.resumeKey);
    // Kunci saat ini diputar. Alias lama yang masih berada di cache (maks. 120 detik)
    // hanya menerima kunci current yang sudah dibuat, sehingga reload multi-tab tidak race.
    const isCurrent=currentKey===resumeKey;
    if(!isCurrent){
      let aliasToken='';try{aliasToken=cleanText_(CacheService.getScriptCache().get(V26_RESUME_CACHE_PREFIX_+resumeKey));}catch(ignoreAlias){}
      if(aliasToken!==token)throw new Error('Sesi tersimpan tidak ditemukan. Silakan login kembali.');
    }
    const u=session_(token);
    const next=isCurrent?v26RotateResumeKey_(env):currentKey;
    return serializeValue_({ok:true,token:token,resumeKey:next,expiresAt:new Date(env.expiresAt),user:publicUser_(u)});
  }
  return withLock_(function(){
    ensureSheetReady_('SESSIONS',SHEET_DEFS.SESSIONS);
    const s=getAllRows_('SESSIONS').find(function(r){return cleanText_(r.ResumeKey)===resumeKey;});
    if(!s)throw new Error('Sesi tersimpan tidak ditemukan. Silakan login kembali.');
    const exp=s.ExpiresAt instanceof Date?s.ExpiresAt:new Date(s.ExpiresAt);
    if(isNaN(exp.getTime())||exp.getTime()<=Date.now()){deleteRowsByPredicate_('SESSIONS',function(r){return cleanText_(r.ResumeKey)===resumeKey;});throw new Error('Sesi berakhir. Silakan login kembali.');}
    const u=findOne_('USERS','UserID',s.UserID);if(!u||!bool_(u.Active))throw new Error('Akun tidak aktif. Hubungi Administrator BPM.');
    const newExpiry=new Date(Date.now()+(Number(AMI_CONFIG.SESSION_HOURS)||12)*3600000),nextResumeKey=randomToken_();
    updateRow_('SESSIONS',s._row,{LastSeenAt:new Date(),ExpiresAt:newExpiry,ResumeKey:nextResumeKey});
    return serializeValue_({ok:true,token:cleanText_(s.Token),resumeKey:nextResumeKey,expiresAt:newExpiry,user:publicUser_(u)});
  });
}

function changePassword(token,oldPassword,newPassword){return withLock_(function(){
  const sessionUser=session_(token),u=findOne_('USERS','UserID',sessionUser.UserID);
  if(!u||!bool_(u.Active))throw new Error('Akun tidak aktif. Hubungi Administrator BPM.');
  newPassword=String(newPassword||'');if(newPassword.length<8)throw new Error('Password baru minimal 8 karakter.');
  if(hashPassword_(oldPassword,u.Salt)!==cleanText_(u.PasswordHash))throw new Error('Password lama salah.');
  const salt=randomSalt_();updateRow_('USERS',u._row,{PasswordHash:hashPassword_(newPassword,salt),Salt:salt,ForceChangePassword:false,UpdatedAt:now_()});
  const av=v26BumpAuthVersion_(u.UserID);v26RefreshSessionAuthVersion_(token,av);
  // Refresh snapshot current session agar ForceChangePassword langsung menjadi false.
  const env=v26LoadSession_(token);if(env){env.userSnapshot=v27UserSnapshot_(Object.assign({},u,{ForceChangePassword:false}));env.userCheckedAt=Date.now();v26SaveSession_(env);}
  deleteRowsByPredicate_('SESSIONS',r=>cleanText_(r.UserID)===cleanText_(u.UserID)&&cleanText_(r.Token)!==cleanText_(token));return{ok:true};
});}

function listUsers(token){requireRole_(token,['ADMIN_BPM']);return getAllRows_('USERS').map(r=>({UserID:r.UserID,Username:r.Username,Nama:r.Nama,Role:r.Role,RefType:r.RefType,RefID:r.RefID,Active:bool_(r.Active),ForceChangePassword:bool_(r.ForceChangePassword),LastLogin:serializeValue_(v26LastLogin_(r.UserID,r.LastLogin))}));}
function resetUserPassword(token,userId,password){return withLock_(function(){const admin=requireRole_(token,['ADMIN_BPM']);const u=findOne_('USERS','UserID',userId);if(!u)throw new Error('Pengguna tidak ditemukan.');password=String(password||AMI_CONFIG.DEFAULT_USER_PASSWORD);if(password.length<8)throw new Error('Password minimal 8 karakter.');const salt=randomSalt_();updateRow_('USERS',u._row,{PasswordHash:hashPassword_(password,salt),Salt:salt,ForceChangePassword:true,UpdatedAt:now_()});v26BumpAuthVersion_(userId);deleteRowsByPredicate_('SESSIONS',r=>cleanText_(r.UserID)===cleanText_(userId));auditLog_(admin,'RESET_PASSWORD','USERS','',userId,'',{Username:u.Username});return{ok:true,username:u.Username,password:password};});}

/* ============================================================
   V28 — BULK RESET PASSWORD PENGGUNA
   - Reset akun terpilih atau seluruh pengguna dalam satu transaksi.
   - Akun ADMIN_BPM yang sedang digunakan tidak ikut reset massal agar
     administrator tidak terputus/terkunci dari aplikasi.
   - Sesi target dinonaktifkan melalui AuthVersion dan legacy SESSIONS.
   ============================================================ */
function resetUserPasswordsBulk(token,payload){return withLock_(function(){
  const admin=requireRole_(token,['ADMIN_BPM']);
  payload=payload||{};
  const mode=cleanText_(payload.mode||'SELECTED').toUpperCase();
  const password=String(payload.password||AMI_CONFIG.DEFAULT_USER_PASSWORD||'ami2026!');
  if(password.length<8)throw new Error('Password minimal 8 karakter.');
  if(['SELECTED','ALL'].indexOf(mode)<0)throw new Error('Mode reset password tidak valid.');

  const users=getAllRows_('USERS');
  const currentAdminId=cleanText_(admin.UserID);
  const selected=new Set((Array.isArray(payload.userIds)?payload.userIds:[]).map(cleanText_).filter(Boolean));
  let targets=users.filter(function(u){
    if(!cleanText_(u.UserID))return false;
    if(cleanText_(u.UserID)===currentAdminId)return false;
    if(mode==='ALL')return true;
    return selected.has(cleanText_(u.UserID));
  });
  if(!targets.length)throw new Error(mode==='ALL'?'Tidak ada akun lain yang dapat direset.':'Pilih minimal satu akun pengguna.');

  const now=now_();
  const recs=targets.map(function(u){
    const salt=randomSalt_();
    return {
      UserID:u.UserID,
      PasswordHash:hashPassword_(password,salt),
      Salt:salt,
      ForceChangePassword:true,
      UpdatedAt:now
    };
  });
  batchUpsert_('USERS',['UserID'],recs,[]);

  // Invalidasi session V26/V27 secara batch untuk menghindari puluhan write terpisah.
  const props=PropertiesService.getScriptProperties();
  const allProps=props.getProperties();
  const propUpdates={},cacheUpdates={};
  const targetIds=new Set();
  targets.forEach(function(u){
    const uid=cleanText_(u.UserID);targetIds.add(uid);
    const pk=v26AuthVersionKey_(uid);
    const n=(Number(allProps[pk]||1)||1)+1;
    propUpdates[pk]=String(n);
    cacheUpdates[V26_AUTHVER_CACHE_PREFIX_+uid]=String(n);
    clearLoginFailure_(u.Username);
  });
  if(Object.keys(propUpdates).length)props.setProperties(propUpdates,false);
  try{if(Object.keys(cacheUpdates).length)CacheService.getScriptCache().putAll(cacheUpdates,600);}catch(ignoreCache){}
  deleteRowsByPredicate_('SESSIONS',function(r){return targetIds.has(cleanText_(r.UserID));});

  auditLog_(admin,'RESET_PASSWORD_BULK','USERS','','','',{
    Mode:mode,
    Total:targets.length,
    UserIDs:Array.from(targetIds),
    CurrentAdminExcluded:true
  });
  return serializeValue_({
    ok:true,
    mode:mode,
    count:targets.length,
    password:password,
    currentAdminExcluded:true,
    users:targets.map(function(u){return{UserID:u.UserID,Username:u.Username,Nama:u.Nama,Role:u.Role};})
  });
});}

function compactUsernamePart_(v){
  return sanitizeUsername_(v).replace(/[._-]+/g,'').substring(0,28);
}
function romanToNumber_(v){
  const x=String(v||'').toUpperCase().replace(/[^IVX]/g,'');
  const map={I:'1',II:'2',III:'3',IV:'4',V:'5'};
  return map[x]||'';
}
function desiredPimpinanUsername_(p){
  p=p||{};
  const level=typeof normalizePimpinanLevel_==='function'?normalizePimpinanLevel_(p.Level):cleanText_(p.Level).toUpperCase();
  const jab=cleanText_(p.Jabatan).toLowerCase();
  const accessId=cleanText_(p.AccessID)||cleanText_(p.UnitID);
  const accessName=cleanText_(p.AccessName);

  if(level==='UNIVERSITAS'){
    if(/(^|\s)rektor($|\s)/i.test(jab)&&!/wakil/i.test(jab))return 'rektoruma';
    if(/wakil\s+rektor/i.test(jab)){
      const m=cleanText_(p.Jabatan).match(/wakil\s+rektor\s+([ivx]+|\d+)/i);
      let n=m?String(m[1]):'';
      if(/^[ivx]+$/i.test(n))n=romanToNumber_(n);
      return 'wakilrektor'+(n||compactUsernamePart_(p.Jabatan).replace(/^wakilrektor/,''))+'uma';
    }
    return (compactUsernamePart_(p.Jabatan)||'pimpinanuniversitas')+'uma';
  }
  if(level==='YAYASAN'){
    if(/ketua/i.test(jab))return 'ketuayayasanuma';
    return 'pimpinanyayasanuma';
  }
  if(level==='FAKULTAS'){
    let x=accessName||accessId;
    x=String(x||'').replace(/^fakultas\s+/i,'');
    return 'pimpinanfakultas'+(compactUsernamePart_(x)||'unit');
  }
  if(level==='PRODI'){
    const prodi=getAllRows_('MASTER_PRODI').find(function(r){return cleanText_(r.ProdiID)===accessId;});
    const code=prodi?cleanText_(prodi.KodeProdi):accessId;
    return 'pimpinanprodi'+(compactUsernamePart_(code)||compactUsernamePart_(accessName)||'unit');
  }
  if(level==='UNIT'){
    const unit=getAllRows_('MASTER_UNIT').find(function(r){return cleanText_(r.UnitID)===accessId;});
    const code=unit?cleanText_(unit.KodeUnit):accessId;
    return 'pimpinan'+(compactUsernamePart_(code)||compactUsernamePart_(accessName)||'unit');
  }
  return 'pimpinan'+(compactUsernamePart_(p.Jabatan)||compactUsernamePart_(p.Nama)||'uma');
}
function uniqueUsername_(base,existing){let x=sanitizeUsername_(base)||'user',n=1,c=x;while(existing.has(c)){n++;c=(x+'.'+n).substring(0,40);}existing.add(c);return c;}
function syncUsersFromMasters(token){return withLock_(function(){
  const admin=requireRole_(token,['ADMIN_BPM']);
  const users=getAllRows_('USERS'),byRef={};
  users.forEach(function(r){if(r.RefType&&r.RefID)byRef[cleanText_(r.RefType)+'|'+cleanText_(r.RefID)]=r;});
  const created=[],renamed=[];

  function usedExcept(userId){
    return new Set(getAllRows_('USERS').filter(function(x){return cleanText_(x.UserID)!==cleanText_(userId);}).map(function(x){return normalizeUsername_(x.Username);}));
  }
  function ensure(refType,refId,name,base,role){
    if(!refId)return;
    const key=refType+'|'+refId,old=byRef[key];

    if(old){
      const patch={};
      let credentialRepaired=false;
      let usernameBefore=cleanText_(old.Username);

      // Master aktif berarti akun yang bersangkutan harus ikut aktif setelah sinkronisasi.
      if(cleanText_(old.Nama)!==cleanText_(name))patch.Nama=name;
      if(cleanText_(old.Role)!==role)patch.Role=role;
      if(!bool_(old.Active))patch.Active=true;

      // V22: akun lama yang pernah dibuat sebelum mekanisme hash aktif dapat memiliki
      // Salt/PasswordHash kosong. Perbaiki hanya akun yang memang rusak; password valid
      // milik pengguna yang sudah ada TIDAK direset.
      if(!cleanText_(old.Salt)||!cleanText_(old.PasswordHash)){
        const password=AMI_CONFIG.DEFAULT_USER_PASSWORD;
        const salt=randomSalt_();
        patch.Salt=salt;
        patch.PasswordHash=hashPassword_(password,salt);
        patch.ForceChangePassword=true;
        credentialRepaired=true;
      }

      // Pimpinan menggunakan username berbasis jabatan/area.
      if(role==='PIMPINAN'){
        const desired=uniqueUsername_(base,usedExcept(old.UserID));
        if(normalizeUsername_(old.Username)!==normalizeUsername_(desired)){
          patch.Username=desired;
          renamed.push({Nama:name,Role:role,UsernameLama:old.Username,UsernameBaru:desired});
        }
      }

      if(Object.keys(patch).length){
        patch.UpdatedAt=now_();
        updateRow_('USERS',old._row,patch);
      }

      if(credentialRepaired || patch.Username || patch.Active===true){
        v26BumpAuthVersion_(old.UserID);
        deleteRowsByPredicate_('SESSIONS',function(s){return cleanText_(s.UserID)===cleanText_(old.UserID);});
      }

      clearLoginFailure_(usernameBefore);
      if(patch.Username)clearLoginFailure_(patch.Username);

      if(credentialRepaired){
        created.push({
          Nama:name,
          Role:role,
          Username:patch.Username||old.Username,
          Password:AMI_CONFIG.DEFAULT_USER_PASSWORD,
          Repaired:true
        });
      }
      return;
    }

    const username=uniqueUsername_(base,usedExcept('')),
      password=AMI_CONFIG.DEFAULT_USER_PASSWORD,salt=randomSalt_(),id=uuid_('USR');

    appendObject_('USERS',{
      UserID:id,Username:username,PasswordHash:hashPassword_(password,salt),Salt:salt,
      Nama:name,Role:role,RefType:refType,RefID:refId,Active:true,
      ForceChangePassword:true,LastLogin:'',CreatedAt:now_(),UpdatedAt:now_()
    });

    byRef[key]={UserID:id,Username:username};
    created.push({Nama:name,Role:role,Username:username,Password:password});
  }

  getAllRows_('MASTER_AUDITOR').filter(function(r){return bool_(r.Active);}).forEach(function(r){ensure('AUDITOR',r.AuditorID,r.Nama,r.NIDN_NIK||('auditor.'+r.AuditorID.slice(-6)),'AUDITOR');});
  getAllRows_('MASTER_PRODI').filter(function(r){return bool_(r.Active);}).forEach(function(r){ensure('PRODI',r.ProdiID,'Auditi — '+r.NamaProdi,r.KodeProdi||('prodi.'+r.ProdiID.slice(-6)),'AUDITI');});
  getAllRows_('MASTER_UNIT').filter(function(r){return bool_(r.Active);}).forEach(function(r){ensure('UNIT',r.UnitID,'Auditi — '+r.NamaUnit,r.KodeUnit||('unit.'+r.UnitID.slice(-6)),'AUDITI');});
  getAllRows_('MASTER_PIMPINAN').filter(function(r){return bool_(r.Active);}).forEach(function(r){ensure('PIMPINAN',r.PimpinanID,r.Nama,desiredPimpinanUsername_(r),'PIMPINAN');});

  const repaired=created.filter(function(x){return !!x.Repaired;}).length;
  auditLog_(admin,'SYNC_USERS','USERS','','','',{created:created.length-repaired,repaired:repaired,renamed:renamed.length});
  return{ok:true,created:created,renamed:renamed,repaired:repaired,totalUsers:getAllRows_('USERS').length};
});}

function maintenanceCheckAuth_(){const rows=getAllRows_('USERS'),a=rows.find(r=>normalizeUsername_(r.Username)==='admin');return{database:db_().getName(),databaseId:db_().getId(),adminExists:!!a,adminActive:a?bool_(a.Active):false,adminRole:a?cleanText_(a.Role):'',hasPasswordHash:a?!!cleanText_(a.PasswordHash):false,hasSalt:a?!!cleanText_(a.Salt):false,sessions:getAllRows_('SESSIONS').length};}


/** Editor-only diagnostics. Nama berakhiran _ sehingga tidak dapat dipanggil dari google.script.run. */
function maintenanceAuthDiagnostics_(){
  const out={version:AMI_CONFIG.VERSION,database:'',databaseId:'',usersSheet:false,sessionsSheet:false,adminExists:false,adminActive:false,adminRole:'',hasSalt:false,hasHash:false,passwordAdmin123Matches:false,loginBlocked:false,loginBlockCount:0,setupComplete:'',setupVersion:'',lastSetupError:''};
  try{
    const ss=db_();out.database=ss.getName();out.databaseId=ss.getId();out.usersSheet=!!ss.getSheetByName('USERS');out.sessionsSheet=!!ss.getSheetByName('SESSIONS');
    const admin=getAllRows_('USERS').find(function(r){return normalizeUsername_(r.Username)==='admin';});
    if(admin){out.adminExists=true;out.adminActive=bool_(admin.Active);out.adminRole=cleanText_(admin.Role);out.hasSalt=!!cleanText_(admin.Salt);out.hasHash=!!cleanText_(admin.PasswordHash);if(out.hasSalt&&out.hasHash)out.passwordAdmin123Matches=hashPassword_('admin123',cleanText_(admin.Salt))===cleanText_(admin.PasswordHash);}
    const cache=CacheService.getScriptCache(),n=Number(cache.get(loginFailCacheKey_('admin'))||0);out.loginBlockCount=n;out.loginBlocked=n>=8;
    const props=PropertiesService.getScriptProperties();out.setupComplete=props.getProperty('AMI_SETUP_COMPLETE')||'';out.setupVersion=props.getProperty('AMI_SETUP_VERSION')||'';out.lastSetupError=props.getProperty('AMI_SETUP_LAST_ERROR')||'';
  }catch(e){out.error=e&&e.message?e.message:String(e);}
  Logger.log(JSON.stringify(out,null,2));return out;
}

/** Editor-only: bersihkan blokir login tanpa mengganti password. */
function maintenanceClearLoginBlock_(){clearAllKnownLoginFailures_();return{ok:true,message:'Blokir percobaan login telah dibersihkan.'};}


/**
 * Editor-only end-to-end test admin login.
 * Jalankan setelah maintenanceResetAdmin_().
 * Nama diakhiri _ agar tidak dapat dipanggil dari google.script.run.
 */
function maintenanceTestAdminLogin_(){
  const result={
    databaseName:'',databaseId:'',usersExists:false,sessionsExists:false,
    adminExists:false,adminActive:false,passwordMatch:false,
    loginFunctionOk:false,sessionFunctionOk:false,error:''
  };
  let token='';
  try{
    const ss=db_();
    result.databaseName=ss.getName();
    result.databaseId=ss.getId();
    result.usersExists=!!ss.getSheetByName('USERS');
    result.sessionsExists=!!ss.getSheetByName('SESSIONS');

    const admin=getAllRows_('USERS').find(function(r){
      return normalizeUsername_(r.Username)==='admin';
    });
    result.adminExists=!!admin;
    result.adminActive=!!admin&&bool_(admin.Active);
    if(!admin)throw new Error('User admin tidak ditemukan pada database yang sedang dibaca.');

    result.passwordMatch=hashPassword_('admin123',cleanText_(admin.Salt))===cleanText_(admin.PasswordHash);
    if(!result.passwordMatch)throw new Error('Password admin123 tidak cocok dengan hash admin di database. Jalankan maintenanceResetAdmin_().');

    // Pastikan blokir lama tidak ikut mengganggu pengujian.
    clearLoginFailure_('admin');
    const auth=login('admin','admin123');
    token=auth&&auth.token?auth.token:'';
    result.loginFunctionOk=!!token;
    if(!token)throw new Error('login() tidak menghasilkan token.');

    const u=session_(token);
    result.sessionFunctionOk=!!u&&cleanText_(u.Role)==='ADMIN_BPM';
    if(!result.sessionFunctionOk)throw new Error('Token dibuat tetapi session_() tidak dapat membaca admin sebagai ADMIN_BPM.');
  }catch(e){
    result.error=e&&e.message?e.message:String(e);
  }finally{
    if(token){try{logout(token);}catch(ignore){}}
  }
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
/** Editor-only: reset admin, bersihkan blokir, lalu uji login+session. */
function perbaikiLoginAdmin_(){
  clearAllKnownLoginFailures_();
  const reset=maintenanceResetAdmin_();
  const test=maintenanceTestAdminLogin_();
  Logger.log(JSON.stringify({reset:reset,test:test},null,2));
  return {ok:!!(test&&test.passwordMatch&&test.loginFunctionOk&&test.sessionFunctionOk&&!test.error),reset:reset,test:test};
}

/** V26 editor-only: ringkasan session store tanpa menampilkan token/resume key. */
function maintenanceSessionHealthV26_(){
  const props=PropertiesService.getScriptProperties().getProperties();
  const now=Date.now();let total=0,active=0,expired=0,resume=0;
  Object.keys(props).forEach(function(k){
    if(k.indexOf(V26_SESSION_PROP_PREFIX_)===0){total++;const e=v26ParseSession_(props[k]);if(e&&Number(e.expiresAt||0)>now)active++;else expired++;}
    else if(k.indexOf(V26_RESUME_PROP_PREFIX_)===0)resume++;
  });
  const out={engine:'V27_FAST_SESSION',persistentSessions:total,activeSessions:active,expiredSessions:expired,resumeMappings:resume,legacySheetSessions:getAllRows_('SESSIONS').length,userRecheckMinutes:Math.round(V27_USER_RECHECK_MS_/60000),resumeAliasSeconds:V27_RESUME_ALIAS_SECONDS_};
  Logger.log(JSON.stringify(out,null,2));return out;
}

/** V26 editor-only: hapus session persistent yang sudah kedaluwarsa. Jalankan berkala bila diperlukan. */
function maintenanceCleanupSessionsV26_(){
  const props=PropertiesService.getScriptProperties(),all=props.getProperties(),now=Date.now();let removed=0;
  Object.keys(all).forEach(function(k){
    if(k.indexOf(V26_SESSION_PROP_PREFIX_)!==0)return;
    const e=v26ParseSession_(all[k]);
    if(!e||Number(e.expiresAt||0)<=now){try{v26DeleteSession_(e&&e.token?e.token:k.substring(V26_SESSION_PROP_PREFIX_.length),e&&e.resumeKey?e.resumeKey:'');removed++;}catch(ignore){}}
  });
  try{cleanupExpiredSessions_();}catch(ignore){}
  try{v27MaybeCleanupFastSessions_();}catch(ignore2){}
  const out={ok:true,removed:removed,message:'Cleanup session V27 selesai.'};Logger.log(JSON.stringify(out));return out;
}

/** V22 editor-only: diagnosis akun login tanpa menampilkan password/hash. */
function maintenanceLoginHealth_(){
  const users=getAllRows_('USERS');
  const out={
    total:users.length,
    active:0,
    inactive:0,
    missingCredential:0,
    roles:{},
    problems:[]
  };
  users.forEach(function(u){
    const role=cleanText_(u.Role)||'TANPA ROLE';
    out.roles[role]=(out.roles[role]||0)+1;
    if(bool_(u.Active))out.active++;else out.inactive++;
    if(!cleanText_(u.Salt)||!cleanText_(u.PasswordHash)){
      out.missingCredential++;
      out.problems.push({Username:cleanText_(u.Username),Nama:cleanText_(u.Nama),Role:role,Problem:'Salt/PasswordHash kosong'});
    }
  });
  Logger.log(JSON.stringify(out,null,2));
  return out;
}
