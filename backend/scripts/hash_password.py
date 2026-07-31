from getpass import getpass
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pwdlib import PasswordHash
def main()->int:
    first=getpass("Administrator password: ");second=getpass("Confirm password: ")
    if not first or first!=second:print("Passwords are empty or do not match.",file=sys.stderr);return 2
    print(PasswordHash.recommended().hash(first));return 0
if __name__=="__main__":raise SystemExit(main())
