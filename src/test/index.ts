var Arr =[

    {sort:1,port:1},
    {sort:1,port:5},
    {sort:1,port:3},
    {sort:2,port:4}

]

var strongArr = Arr.filter(item=>item.sort==1)
strongArr=strongArr.sort((a,b)=>a.port-b.port)
var weakArr = Arr.filter(item=>item.sort==2)
weakArr = weakArr.sort((a,b)=>a.port-b.port)

function add(){
    strongArr.push({
        sort:1,
        port:strongArr.length+1
    }
    )
}