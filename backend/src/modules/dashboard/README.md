# Dashboard module

Dashboard adalah read model sementara untuk ringkasan student. Route menjaga
ownership dan first-login guard, service memvalidasi student id, dan repository
menyediakan adapter fixture. Jangan menambah join lintas domain di route; buat
view/RPC read model setelah kontrak data disepakati.
