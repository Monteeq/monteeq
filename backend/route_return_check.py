import ast
from pathlib import Path
root = Path('app/api/v1/endpoints')
route_funcs = []

for path in sorted(root.rglob('*.py')):
    text = path.read_text(encoding='utf-8')
    try:
        tree = ast.parse(text)
    except Exception as e:
        print('PARSE ERROR', path, e)
        continue

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                if isinstance(dec, ast.Attribute) and isinstance(dec.value, ast.Name) and dec.value.id == 'router' and dec.attr in {'get','post','put','delete','patch','options','head'}:
                    route_funcs.append((path, node.name, node.lineno, node))
                    break


def ends_with_return(node):
    if not node.body:
        return False
    last = node.body[-1]
    if isinstance(last, (ast.Return, ast.Raise)):
        return True
    # if last statement is if/for/while/try, check all branches
    if isinstance(last, ast.If):
        return ends_with_return(last)  # using helper below
    if isinstance(last, (ast.For, ast.While, ast.AsyncFor)):
        return False
    if isinstance(last, ast.Try):
        return False
    return False


def ends_with_return(stmt):
    if isinstance(stmt, (ast.Return, ast.Raise)):
        return True
    if isinstance(stmt, ast.If):
        if not stmt.body or not stmt.orelse:
            return False
        return ends_with_return(stmt.body[-1]) and ends_with_return(stmt.orelse[-1])
    if isinstance(stmt, ast.Try):
        handlers = stmt.handlers
        if not stmt.finalbody or not handlers:
            return False
        return ends_with_return(stmt.body[-1]) and all(ends_with_return(h.body[-1]) for h in handlers) and ends_with_return(stmt.finalbody[-1])
    return False

for path, name, lineno, node in route_funcs:
    if not ends_with_return(node):
        print('POSSIBLE', path, name, lineno)
print('TOTAL ROUTES', len(route_funcs))
