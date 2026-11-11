import io
s=io.open(r'.qa-verify/g7-decode-durations.mjs',encoding='utf-8').read().splitlines()
print(repr(s[39]))
