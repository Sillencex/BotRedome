const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
var buscaCep = require('busca-cep');
const moment = require('moment');

const { WebhookClient } = require('dialogflow-fulfillment');

const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

app.post('/dialogflow-fulfillment', async (request, response) => {
    dialogflowFulfillment(request, response);
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

const dialogflowFulfillment = (request, response) => {
    const agent = new WebhookClient({ request, response });

    function welcome(agent) {
        agent.add("");
    }

    async function usuarioAcesso(agent) {
        let intentName = request.body.queryResult.intent.displayName;
        let data_nascimento = request.body.queryResult.parameters['data_nascimento'];
        let data = moment(data_nascimento, 'DD/MM/YYYY');
        let data_formatada = data.format('YYYY-MM-DD');
        let cpf = agent.parameters.cpf;

        //let login = false;

        let dados = {
            nome: request.body.queryResult.parameters['nome'],
            nome_mae: request.body.queryResult.parameters['nome_mae'],
            data_nascimento: data_formatada,
            cpf: cpf ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : null,
        }

        if (intentName == "usuario.acesso.cpf.teste") {
                try {
                    const { data } = await axios.post('https://appredome.clientes.lojainterativa.com/api/external/login', dados)
                    var token = data.token;
                    login = true;
                    console.log(token)
                    console.log(login)
                    if (login) {
                        tokenGlobal = token;
                        agent.add("Cadastro encontrado com sucesso! " + "\n" + "\n" + "Por favor, informe o CEP")
                    }
                } catch (erro) {
                    console.log(erro.data)
                    agent.add("Usuário não encontrado, gostaria de tentar novamente?" + "\n" + "\n" + "1- Sim" + "\n" + "2- Não");
                    return;
                }
            }

        if (intentName == "usuario.acesso.cpf") {
            console.log("usuario.acesso.cpf: " + JSON.stringify(dados));
            if (!validaCPF(dados.cpf)) {
                agent.add("");
                agent.setFollowupEvent("usuario.acesso.cpf-invalido");
                return;
            } else {
                try {
                    const { data } = await axios.post('https://appredome.clientes.lojainterativa.com/api/external/login', dados)
                    var token = data.token;
                    login = true;
                    console.log(token)
                    console.log(login)
                    if (login) {
                        tokenGlobal = token;
                        console.log(tokenGlobal);
                        agent.add("Cadastro encontrado com sucesso! " + "\n" + "\n" + "Por favor, informe o CEP")
                    }
                } catch (erro) {
                    console.log(erro.data)
                    agent.add("Usuário não encontrado, gostaria de tentar novamente?" + "\n" + "\n" + "1- Sim" + "\n" + "2- Não");
                    return;
                }
            }
        }

        if (intentName == "usuario.acesso.sem-cpf") {
            console.log("usuario.acesso: " + JSON.stringify(dados))
            const { data } = await axios.post('https://appredome.clientes.lojainterativa.com/api/external/login', dados);
            var token = data.token;
            tokenGlobal = token;
            console.log(tokenGlobal);
            agent.add("Cadastro encontrado com sucesso! " + "\n" + "\n" + "Por favor, informe o CEP")
        }

        // if (intentName == "usuario.acesso.cpf-valido") {
        //     console.log("usuario.acesso.cpf-valido: " + JSON.stringify(dados))
        //     if (!validaCPF(dados.cpf)) {
        //         agent.add("");
        //         agent.setFollowupEvent("usuario.acesso.cpf-invalido");
        //         return;
        //     } else {
        //         const { data } = await axios.post('https://appredome.clientes.lojainterativa.com/api/external/login', dados);
        //         var token = data.token;
        //         tokenGlobal = token;
        //         console.log(token);
        //         agent.add("Cadastro encontrado com sucesso! " + "\n" + "\n" + "Por favor, informe o CEP")
        //     }
        // }
    }

    function update(agent) {
        var cep = request.body.queryResult.parameters['cep'];

        const api = axios.create({
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json',
                'Authorization': `Bearer ${tokenGlobal}`
            },
            credentials: true
        })
        console.log(api.defaults.headers.Authorization)
        try {
            buscaCep(cep, { sync: false, timeout: 1000 }).then(endereco => {
                var local = {
                    rua: endereco.logradouro,
                    bairro: endereco.bairro,
                    municipio: endereco.ibge,
                    estado: endereco.uf,
                    cep: endereco.cep,
                    numero: request.body.queryResult.parameters['numero'],
                    complemento: request.body.queryResult.parameters['complemento'],
                    telefone: "(" + ")" + request.body.queryResult.parameters['telefone'].replace(/(\d{5})(\d{4})/, '$1-$2')
                }

                api.put('https://appredome.clientes.lojainterativa.com/api/external/doadores', local)
                    .then(response => {
                        console.log(response.data);
                    })
                    .catch(error => {
                        console.error(error.response.data);
                    });
            });
            agent.add("Cadastro alterado com sucesso");
            console.log()
        } catch (error) {
            console.error(error);
            agent.add("Ocorreu um erro ao atualizar o cadastro. Por favor, tente novamente mais tarde.");
        }
    }

    function cpfInvalido(agent) {
        agent.add("CPF inválido. Gostaria de continuar sem informar o CPF?" + "\n" + "\n" + "1- Sim" + "\n" + "2- Não");
        //agent.setFollowupEvent("usuario.acesso");
    }

    function validaCPF(cpf) {
        var soma = 0;
        var resto;

        cpf = cpf.replace(/[.-]/g, "");

        if (cpf == "00000000000") return false;

        for (i = 1; i <= 9; i++)
            soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
        resto = (soma * 10) % 11;

        if (resto == 10 || resto == 11) resto = 0;
        if (resto != parseInt(cpf.substring(9, 10))) return false;

        soma = 0;
        for (i = 1; i <= 10; i++)
            soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
        resto = (soma * 10) % 11;

        if (resto == 10 || resto == 11) resto = 0;
        if (resto != parseInt(cpf.substring(10, 11))) return false;
        return true;
    }

    let intentMap = new Map();
    intentMap.set("Default Welcome Intent", welcome);
    intentMap.set("usuario.acesso.cpf", usuarioAcesso);
    intentMap.set("usuario.acesso.cpf.teste", usuarioAcesso);
    intentMap.set("usuario.acesso.sem-cpf", usuarioAcesso);
    intentMap.set("usuario.acesso.cpf-valido", usuarioAcesso);
    intentMap.set("usuario.acesso.cpf-invalido", cpfInvalido);
    intentMap.set("endereco.atualizar", update);
    agent.handleRequest(intentMap);
}