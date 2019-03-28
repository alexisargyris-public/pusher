// converted to typescript from http://www.movable-type.co.uk/scripts/tea-block.html (node.js only, not browser)

export class Tea {
  encrypt(plaintext: string, password: string): string {
    plaintext = String(plaintext)
    password = String(password)

    if (plaintext.length == 0) return('')  // nothing to encrypt

    //  v is n-word data vector; converted to array of longs from UTF-8 string
    var v = this.strToLongs(this.utf8Encode(plaintext))
    //  k is 4-word key; simply convert first 16 chars of password as key
    var k = this.strToLongs(this.utf8Encode(password).slice(0,16))

    v = this.encode(v, k)

    // convert array of longs to string
    var ciphertext = this.longsToStr(v)

    // convert binary string to base64 ascii for safe transport
    return this.base64Encode(ciphertext)
  }
  decrypt(ciphertext: string, password: string): string {
    ciphertext = String(ciphertext)
    password = String(password)

    if (ciphertext.length == 0) return('')

    //  v is n-word data vector; converted to array of longs from base64 string
    var v = this.strToLongs(this.base64Decode(ciphertext))
    //  k is 4-word key; simply convert first 16 chars of password as key
    var k = this.strToLongs(this.utf8Encode(password).slice(0,16))

    v = this.decode(v, k)

    var plaintext = this.longsToStr(v)

    // strip trailing null chars resulting from filling 4-char blocks:
    plaintext = plaintext.replace(/\0+$/,'')

    return this.utf8Decode(plaintext)
  }
  encode(v: any, k: any): any {
    if (v.length < 2) v[1] = 0  // algorithm doesn't work for n<2 so fudge by adding a null
    var n = v.length

    var z = v[n-1], y = v[0], delta = 0x9e3779b9
    var mx, e, q = Math.floor(6 + 52/n), sum = 0

    while (q-- > 0) {  // 6 + 52/n operations gives between 6 & 32 mixes on each word
        sum += delta
        e = sum>>>2 & 3
        for (var p = 0; p < n; p++) {
            y = v[(p+1)%n]
            mx = (z>>>5 ^ y<<2) + (y>>>3 ^ z<<4) ^ (sum^y) + (k[p&3 ^ e] ^ z)
            z = v[p] += mx
        }
    }

    return v
  }
  decode(v: any, k: any): any {
    var n = v.length

    var z = v[n-1], y = v[0], delta = 0x9e3779b9
    var mx, e, q = Math.floor(6 + 52/n), sum = q*delta

    while (sum != 0) {
        e = sum>>>2 & 3
        for (var p = n-1; p >= 0; p--) {
            z = v[p>0 ? p-1 : n-1]
            mx = (z>>>5 ^ y<<2) + (y>>>3 ^ z<<4) ^ (sum^y) + (k[p&3 ^ e] ^ z)
            y = v[p] -= mx
        }
        sum -= delta
    }

    return v
  }
  strToLongs(s: string): any {
    // note chars must be within ISO-8859-1 (Unicode code-point <= U+00FF) to fit 4/long
    var l = new Array(Math.ceil(s.length/4))
    for (var i=0; i<l.length; i++) {
        // note little-endian encoding - endianness is irrelevant as long as it matches longsToStr()
        l[i] = s.charCodeAt(i*4)        + (s.charCodeAt(i*4+1)<<8) +
              (s.charCodeAt(i*4+2)<<16) + (s.charCodeAt(i*4+3)<<24)
    } // note running off the end of the string generates nulls since bitwise operators treat NaN as 0
    return l
  }
  longsToStr(l: any): string {
    var str = ''
    for (var i=0; i<l.length; i++) {
        str += String.fromCharCode(l[i] & 0xff, l[i]>>>8 & 0xff, l[i]>>>16 & 0xff, l[i]>>>24 & 0xff)
    }
    return str
  }
  utf8Encode(str: string): string {
    return unescape(encodeURIComponent(str))
  }
  utf8Decode(utf8Str: string): string {
    try {
        return decodeURIComponent(escape(utf8Str))
    } catch (e) {
        return utf8Str // invalid UTF-8? return as-is
    }
  }
  base64Encode(str: string): string {
    return Buffer.from(str, 'binary').toString('base64')
  }
  base64Decode(b64Str: string) {
    return Buffer.from(b64Str, 'base64').toString('binary')
  }
}