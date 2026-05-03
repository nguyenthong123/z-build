
with open('src/components/ProductDetail.css', 'r') as f:
    balance = 0
    for i, line in enumerate(f, 1):
        balance += line.count('{')
        balance -= line.count('}')
        if balance < 0:
            print(f"Balance went negative at line {i}: {line.strip()}")
            balance = 0
    print(f"Final balance: {balance}")
